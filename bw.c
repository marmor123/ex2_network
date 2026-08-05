/*
 * Copyright (c) 2005 Topspin Communications.  All rights reserved.
 * Copyright (c) 2006 Cisco Systems.  All rights reserved.
 *
 * This software is available to you under a choice of one of two
 * licenses.  You may choose to be licensed under the terms of the GNU
 * General Public License (GPL) Version 2, available from the file
 * COPYING in the main directory of this source tree, or the
 * OpenIB.org BSD license below:
 *
 *     Redistribution and use in source and binary forms, with or
 *     without modification, are permitted provided that the following
 *     conditions are met:
 *
 *      - Redistributions of source code must retain the above
 *        copyright notice, this list of conditions and the following
 *        disclaimer.
 *
 *      - Redistributions in binary form must reproduce the above
 *        copyright notice, this list of conditions and the following
 *        disclaimer in the documentation and/or other materials
 *        provided with the distribution.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/*
 * Lab #2 — Verbs throughput benchmark (single source, server and client
 * roles decided by argv: no hostname argument = server, hostname = client).
 *
 * Stage 2 (T2): the connectivity layer end-to-end. Device init; the two
 * 1 MB buffer registrations (the server's with remote-write permission);
 * QP create → init → RTR → RTS with the port's active MTU; the handshake
 * over TCP exchanging LID/QPN/PSN/GID plus the server's buffer addr/rkey;
 * both control receive pools posted at init. Both processes then exit 0
 * with nothing printed. The data path (RDMA WRITEs, the done/ack control
 * messages, timing) lands in later stages.
 *
 * Adapted from the assignment's bw_template.c: the socket exchange is the
 * template's, extended with the server's buffer address and rkey; the QP
 * lifecycle (INIT/RTR/RTS, rnr_retry/retry_cnt, access flags) is the
 * template's.
 */

/* asprintf and the srand48/lrand48 family are GNU/SVID extensions: newer
 * glibc exposes them by default, the course nodes' older glibc only with
 * _GNU_SOURCE. Must precede every system header. */
#define _GNU_SOURCE

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/param.h>
#include <sys/time.h>
#include <getopt.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <time.h>
#include <inttypes.h>

#include <infiniband/verbs.h>

/* One 1 MB buffer per side, registered once and never modified after init,
 * so there is no buffer-reuse hazard at full window depth (ADR-0002). */
#define BUFFER_SIZE (1u << 20)

/* Control receive pool (ADR-0001): 32 receives per side, posted once at
 * init, all pointing at one control area, never refreshed. Covers the 21
 * per-direction control messages of a full sweep. */
#define CTRL_POOL_DEPTH 32
#define CTRL_MSG_LEN 64

/* The SQ depth is the window (W) plus slack: the slack absorbs the warmup
 * WRs riding ahead of the window plus the per-size control SENDs. Sized for
 * the warmup counts of the ex1 counts table; re-verified when the table
 * lands with the data path. */
#define QP_SLACK 1024

#define WINDOW_DEFAULT 256

/* The max_inline_data declared at QP creation. mlx4 — the course hardware —
 * rejects QP creation if the declared value exceeds the 1024 bytes its
 * WQEs can carry, so the declaration must never exceed that. The value the
 * QP was actually created with is read back via ibv_query_qp; that
 * read-back is the runtime max_inline_data the data path uses
 * (ibv_query_device no longer exposes it on modern rdma-core). */
#define MAX_INLINE_DATA_DECLARE 1024

/* Fixed-size handshake message, both directions. The client's message
 * carries only the first four fields (addr/rkey are the server's to give). */
#define DEST_MSG_LEN 128

/* The handshake's wire format, kept in one place so the send and parse
 * sides cannot drift: lid:qpn:psn:gid, plus :addr:rkey on the server. */
#define DEST_FMT         "%04x:%06x:%06x:%s"
#define DEST_FMT_SERVER  DEST_FMT ":%" PRIx64 ":%x"
#define DEST_FMT_PARSE   "%x:%x:%x:%32[0-9a-fA-F]:%" SCNx64 ":%x"

enum {
    /* A control receive (the done on the server, the ack on the client). */
    BW_RECV_WRID = 1,
};

static int page_size;

struct bw_context {
    struct ibv_context		*context;
    struct ibv_pd		*pd;
    struct ibv_mr		*mr;      /* the 1 MB buffer */
    struct ibv_mr		*ctrl_mr; /* the control receive area */
    struct ibv_cq		*cq;
    struct ibv_qp		*qp;
    void			*buf;     /* the 1 MB buffer */
    void			*ctrl_buf;/* the control receive area */
    uint32_t		 max_inline_data; /* the QP's negotiated max_inline_data */
    struct ibv_port_attr	 portinfo;
};

struct bw_dest {
    int lid;
    int qpn;
    int psn;
    union ibv_gid gid;
    /* Server side only: buffer address and rkey for the client's RDMA
     * WRITEs. Zero on the client (the server never touches client memory). */
    uint64_t buf_addr;
    uint32_t rkey;
};

void wire_gid_to_gid(const char *wgid, union ibv_gid *gid)
{
    char tmp[9];
    uint32_t v32;
    int i;

    for (tmp[8] = 0, i = 0; i < 4; ++i) {
        memcpy(tmp, wgid + i * 8, 8);
        sscanf(tmp, "%x", &v32);
        *(uint32_t *)(&gid->raw[i * 4]) = ntohl(v32);
    }
}

void gid_to_wire_gid(const union ibv_gid *gid, char wgid[])
{
    int i;

    for (i = 0; i < 4; ++i)
        sprintf(&wgid[i * 8], "%08x", htonl(*(uint32_t *)(gid->raw + i * 4)));
}

/* Loop until len bytes move or the stream ends: the handshake messages are
 * fixed-size, and a short read would break the parse. */
static int bw_read_full(int fd, void *buf, size_t len)
{
    size_t got = 0;

    while (got < len) {
        ssize_t n = read(fd, (char *) buf + got, len - got);
        if (n <= 0)
            return 0;
        got += n;
    }
    return 1;
}

static int bw_write_full(int fd, const void *buf, size_t len)
{
    size_t sent = 0;

    while (sent < len) {
        ssize_t n = write(fd, (const char *) buf + sent, len - sent);
        if (n <= 0)
            return 0;
        sent += n;
    }
    return 1;
}

static struct bw_dest *bw_parse_dest(const char *msg, int expect_addr)
{
    struct bw_dest *dest = calloc(1, sizeof *dest);
    char gid[33];
    int n;

    if (!dest)
        return NULL;

    /* The server's message carries all six fields; the client's carries the
     * first four (addr/rkey stay zero). The client expects the server's
     * addr/rkey — its RDMA WRITEs land there — so it requires all six; a
     * truncated server message must not pass with addr/rkey zero. */
    n = sscanf(msg, DEST_FMT_PARSE,
               &dest->lid, &dest->qpn, &dest->psn, gid,
               &dest->buf_addr, &dest->rkey);
    if (n < 4 || (expect_addr && n < 6)) {
        free(dest);
        return NULL;
    }

    wire_gid_to_gid(gid, &dest->gid);
    return dest;
}

static int bw_connect_qp(struct bw_context *ctx, int port, int my_psn,
                         enum ibv_mtu mtu,
                         struct bw_dest *dest, int sgid_idx)
{
    struct ibv_qp_attr attr = {
            .qp_state		= IBV_QPS_RTR,
            .path_mtu		= mtu,
            .dest_qp_num		= dest->qpn,
            .rq_psn			= dest->psn,
            .max_dest_rd_atomic	= 1,
            .min_rnr_timer		= 12,
            .ah_attr		= {
                    .is_global	= 0,
                    .dlid		= dest->lid,
                    .sl		= 0,
                    .src_path_bits	= 0,
                    .port_num	= port
            }
    };

    /* GRH addressing is used iff the remote advertised a nonzero GID and we
     * have a GID index of our own; a remote GID with no local index (-g on
     * one side only) therefore degrades to LID-based addressing — the course
     * fabric's normal mode — instead of failing RTR on sgid_index = -1. */
    if (dest->gid.global.interface_id && sgid_idx >= 0) {
        attr.ah_attr.is_global = 1;
        attr.ah_attr.grh.hop_limit = 1;
        attr.ah_attr.grh.dgid = dest->gid;
        attr.ah_attr.grh.sgid_index = sgid_idx;
    }
    if (ibv_modify_qp(ctx->qp, &attr,
            IBV_QP_STATE              |
            IBV_QP_AV                 |
            IBV_QP_PATH_MTU           |
            IBV_QP_DEST_QPN           |
            IBV_QP_RQ_PSN             |
            IBV_QP_MAX_DEST_RD_ATOMIC |
            IBV_QP_MIN_RNR_TIMER)) {
        fprintf(stderr, "Failed to modify QP to RTR\n");
        return 1;
    }

    attr.qp_state	    = IBV_QPS_RTS;
    attr.timeout	    = 14;
    attr.retry_cnt	    = 7;
    attr.rnr_retry	    = 7;
    attr.sq_psn	    = my_psn;
    attr.max_rd_atomic  = 1;
    if (ibv_modify_qp(ctx->qp, &attr,
            IBV_QP_STATE              |
            IBV_QP_TIMEOUT            |
            IBV_QP_RETRY_CNT          |
            IBV_QP_RNR_RETRY          |
            IBV_QP_SQ_PSN             |
            IBV_QP_MAX_QP_RD_ATOMIC)) {
        fprintf(stderr, "Failed to modify QP to RTS\n");
        return 1;
    }

    return 0;
}

static struct bw_dest *bw_exch_dest_client(const char *servername, int port,
                                           const struct bw_dest *my_dest)
{
    struct addrinfo *res, *t;
    struct addrinfo hints = {
            .ai_family   = AF_INET,
            .ai_socktype = SOCK_STREAM
    };
    char *service;
    char msg[DEST_MSG_LEN];
    int n;
    int sockfd = -1;
    struct bw_dest *rem_dest = NULL;
    char gid[33];

    if (asprintf(&service, "%d", port) < 0)
        return NULL;

    n = getaddrinfo(servername, service, &hints, &res);

    if (n < 0) {
        fprintf(stderr, "%s for %s:%d\n", gai_strerror(n), servername, port);
        free(service);
        return NULL;
    }

    for (t = res; t; t = t->ai_next) {
        sockfd = socket(t->ai_family, t->ai_socktype, t->ai_protocol);
        if (sockfd >= 0) {
            if (!connect(sockfd, t->ai_addr, t->ai_addrlen))
                break;
            close(sockfd);
            sockfd = -1;
        }
    }

    freeaddrinfo(res);
    free(service);

    if (sockfd < 0) {
        /* No server listening: fail silently — exit non-zero with nothing
           printed (T1 acceptance criterion). */
        return NULL;
    }

    gid_to_wire_gid(&my_dest->gid, gid);
    memset(msg, 0, sizeof msg);
    sprintf(msg, DEST_FMT, my_dest->lid, my_dest->qpn, my_dest->psn, gid);
    if (!bw_write_full(sockfd, msg, sizeof msg)) {
        fprintf(stderr, "Couldn't send local address\n");
        goto out;
    }

    if (!bw_read_full(sockfd, msg, sizeof msg)) {
        perror("client read");
        fprintf(stderr, "Couldn't read remote address\n");
        goto out;
    }

    /* The server keeps the socket open until we signal receipt, so this
     * must go out before we close. */
    if (!bw_write_full(sockfd, "ready", sizeof "ready")) {
        perror("client write");
        goto out;
    }

    rem_dest = bw_parse_dest(msg, 1);
    if (!rem_dest) {
        fprintf(stderr, "Couldn't parse remote address\n");
        goto out;
    }

out:
    close(sockfd);
    return rem_dest;
}

static struct bw_dest *bw_exch_dest_server(struct bw_context *ctx,
                                           int ib_port, enum ibv_mtu mtu,
                                           int port,
                                           const struct bw_dest *my_dest,
                                           int sgid_idx)
{
    struct addrinfo *res, *t;
    struct addrinfo hints = {
            .ai_flags    = AI_PASSIVE,
            .ai_family   = AF_INET,
            .ai_socktype = SOCK_STREAM
    };
    char *service;
    char msg[DEST_MSG_LEN];
    int n;
    int sockfd = -1, connfd;
    struct bw_dest *rem_dest = NULL;
    char gid[33];

    if (asprintf(&service, "%d", port) < 0)
        return NULL;

    n = getaddrinfo(NULL, service, &hints, &res);

    if (n < 0) {
        fprintf(stderr, "%s for port %d\n", gai_strerror(n), port);
        free(service);
        return NULL;
    }

    for (t = res; t; t = t->ai_next) {
        sockfd = socket(t->ai_family, t->ai_socktype, t->ai_protocol);
        if (sockfd >= 0) {
            n = 1;

            setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &n, sizeof n);

            if (!bind(sockfd, t->ai_addr, t->ai_addrlen))
                break;
            close(sockfd);
            sockfd = -1;
        }
    }

    freeaddrinfo(res);
    free(service);

    if (sockfd < 0) {
        fprintf(stderr, "Couldn't listen to port %d\n", port);
        return NULL;
    }

    listen(sockfd, 1);
    connfd = accept(sockfd, NULL, 0);
    close(sockfd);
    if (connfd < 0) {
        fprintf(stderr, "accept() failed\n");
        return NULL;
    }

    if (!bw_read_full(connfd, msg, sizeof msg)) {
        perror("server read");
        fprintf(stderr, "Couldn't read remote address\n");
        goto out;
    }

    rem_dest = bw_parse_dest(msg, 0);
    if (!rem_dest) {
        fprintf(stderr, "Couldn't parse remote address\n");
        goto out;
    }

    if (bw_connect_qp(ctx, ib_port, my_dest->psn, mtu, rem_dest, sgid_idx)) {
        fprintf(stderr, "Couldn't connect to remote QP\n");
        free(rem_dest);
        rem_dest = NULL;
        goto out;
    }

    /* Send our address plus the buffer addr/rkey the client needs for its
     * RDMA WRITEs. */
    gid_to_wire_gid(&my_dest->gid, gid);
    memset(msg, 0, sizeof msg);
    sprintf(msg, DEST_FMT_SERVER,
            my_dest->lid, my_dest->qpn, my_dest->psn, gid,
            my_dest->buf_addr, my_dest->rkey);
    if (!bw_write_full(connfd, msg, sizeof msg)) {
        fprintf(stderr, "Couldn't send local address\n");
        free(rem_dest);
        rem_dest = NULL;
        goto out;
    }

    /* Final beat: the client signals it has our address with "ready" and
     * closes. The template leaves this read unchecked; the message is
     * short, so check the count, not the message size. */
    {
        char ready[sizeof "ready"];

        if (!bw_read_full(connfd, ready, sizeof ready)) {
            perror("server read");
            free(rem_dest);
            rem_dest = NULL;
            goto out;
        }
    }

out:
    close(connfd);
    return rem_dest;
}

static struct bw_context *bw_init_ctx(struct ibv_device *ib_dev, int port,
                                      int window, int is_server)
{
    struct bw_context *ctx;

    ctx = calloc(1, sizeof *ctx);
    if (!ctx)
        return NULL;

    ctx->buf = malloc(roundup(BUFFER_SIZE, page_size));
    if (!ctx->buf) {
        fprintf(stderr, "Couldn't allocate work buf.\n");
        return NULL;
    }

    memset(ctx->buf, 0x7b + is_server, BUFFER_SIZE);

    ctx->ctrl_buf = malloc(CTRL_MSG_LEN);
    if (!ctx->ctrl_buf) {
        fprintf(stderr, "Couldn't allocate control buf.\n");
        return NULL;
    }

    ctx->context = ibv_open_device(ib_dev);
    if (!ctx->context) {
        fprintf(stderr, "Couldn't get context for %s\n",
                ibv_get_device_name(ib_dev));
        return NULL;
    }

    ctx->pd = ibv_alloc_pd(ctx->context);
    if (!ctx->pd) {
        fprintf(stderr, "Couldn't allocate PD\n");
        return NULL;
    }

    /* The server's buffer must accept remote writes (the client's RDMA
     * WRITEs land here); the client's is only read by its own HCA. */
    ctx->mr = ibv_reg_mr(ctx->pd, ctx->buf, BUFFER_SIZE,
                         IBV_ACCESS_LOCAL_WRITE |
                         (is_server ? IBV_ACCESS_REMOTE_WRITE : 0));
    if (!ctx->mr) {
        fprintf(stderr, "Couldn't register MR\n");
        return NULL;
    }

    ctx->ctrl_mr = ibv_reg_mr(ctx->pd, ctx->ctrl_buf, CTRL_MSG_LEN,
                              IBV_ACCESS_LOCAL_WRITE);
    if (!ctx->ctrl_mr) {
        fprintf(stderr, "Couldn't register control MR\n");
        return NULL;
    }

    ctx->cq = ibv_create_cq(ctx->context, window + QP_SLACK + CTRL_POOL_DEPTH,
                            NULL, NULL, 0);
    if (!ctx->cq) {
        fprintf(stderr, "Couldn't create CQ\n");
        return NULL;
    }

    {
        struct ibv_qp_init_attr attr = {
                .send_cq = ctx->cq,
                .recv_cq = ctx->cq,
                .cap     = {
                        .max_send_wr  = window + QP_SLACK,
                        .max_recv_wr  = CTRL_POOL_DEPTH,
                        .max_send_sge = 1,
                        .max_recv_sge = 1,
                        /* Declared at QP creation: mlx4 rejects the QP if
                         * the request exceeds the hardware's max_inline_data. */
                        .max_inline_data = MAX_INLINE_DATA_DECLARE
                },
                .qp_type = IBV_QPT_RC
        };

        ctx->qp = ibv_create_qp(ctx->pd, &attr);
        if (!ctx->qp)  {
            fprintf(stderr, "Couldn't create QP\n");
            return NULL;
        }
    }

    {
        /* The runtime max_inline_data: read back what the QP was created
         * with, since the driver may clamp the request. */
        struct ibv_qp_attr attr;
        struct ibv_qp_init_attr init_attr;

        if (ibv_query_qp(ctx->qp, &attr, IBV_QP_CAP, &init_attr)) {
            fprintf(stderr, "Couldn't query QP attributes\n");
            return NULL;
        }
        ctx->max_inline_data = init_attr.cap.max_inline_data;
    }

    {
        struct ibv_qp_attr attr = {
                .qp_state        = IBV_QPS_INIT,
                .pkey_index      = 0,
                .port_num        = port,
                .qp_access_flags = IBV_ACCESS_REMOTE_READ |
                IBV_ACCESS_REMOTE_WRITE
        };

        if (ibv_modify_qp(ctx->qp, &attr,
                IBV_QP_STATE              |
                IBV_QP_PKEY_INDEX         |
                IBV_QP_PORT               |
                IBV_QP_ACCESS_FLAGS)) {
            fprintf(stderr, "Failed to modify QP to INIT\n");
            return NULL;
        }
    }

    return ctx;
}

/* Post the entire control receive pool — never refreshed: each control
 * message consumes one pre-posted receive, and 32 cover a full sweep
 * (ADR-0001, assignment item 3). Returns 0 when all are posted. */
static int bw_post_control_recvs(struct bw_context *ctx)
{
    struct ibv_sge list = {
            .addr	= (uint64_t) ctx->ctrl_buf,
            .length = CTRL_MSG_LEN,
            .lkey	= ctx->ctrl_mr->lkey
    };
    struct ibv_recv_wr wr = {
            .wr_id	    = BW_RECV_WRID,
            .sg_list    = &list,
            .num_sge    = 1,
            .next       = NULL
    };
    struct ibv_recv_wr *bad_wr;
    int i;

    for (i = 0; i < CTRL_POOL_DEPTH; ++i)
        if (ibv_post_recv(ctx->qp, &wr, &bad_wr))
            break;

    return i == CTRL_POOL_DEPTH ? 0 : 1;
}

static int bw_close_ctx(struct bw_context *ctx)
{
    if (ibv_destroy_qp(ctx->qp)) {
        fprintf(stderr, "Couldn't destroy QP\n");
        return 1;
    }

    if (ibv_destroy_cq(ctx->cq)) {
        fprintf(stderr, "Couldn't destroy CQ\n");
        return 1;
    }

    if (ibv_dereg_mr(ctx->ctrl_mr)) {
        fprintf(stderr, "Couldn't deregister control MR\n");
        return 1;
    }

    if (ibv_dereg_mr(ctx->mr)) {
        fprintf(stderr, "Couldn't deregister MR\n");
        return 1;
    }

    if (ibv_dealloc_pd(ctx->pd)) {
        fprintf(stderr, "Couldn't deallocate PD\n");
        return 1;
    }

    if (ibv_close_device(ctx->context)) {
        fprintf(stderr, "Couldn't release context\n");
        return 1;
    }

    free(ctx->ctrl_buf);
    free(ctx->buf);
    free(ctx);

    return 0;
}

static void usage(const char *argv0)
{
    printf("Usage:\n");
    printf("  %s            start a server and wait for connection\n", argv0);
    printf("  %s <host>     connect to server at <host>\n", argv0);
    printf("\n");
    printf("Options:\n");
    printf("  -p, --port=<port>      handshake port (default 18515)\n");
    printf("  -d, --ib-dev=<dev>     use IB device <dev> (default first device found)\n");
    printf("  -i, --ib-port=<port>   use port <port> of IB device (default 1)\n");
    printf("  -r, --window=<depth>   window depth W: max outstanding data WRs (default %d)\n",
           WINDOW_DEFAULT);
    printf("  -g, --gid-idx=<index>  local port gid index (default: LID-based)\n");
}

int main(int argc, char *argv[])
{
    struct ibv_device      **dev_list;
    struct ibv_device       *ib_dev;
    struct bw_context       *ctx;
    struct bw_dest          my_dest;
    struct bw_dest         *rem_dest;
    char                    *ib_devname = NULL;
    char                    *servername = NULL;
    int                      port = 18515; /* matches usage() */
    int                      ib_port = 1;
    int                      window = WINDOW_DEFAULT;
    int                      gidx = -1;

    srand48(getpid() * time(NULL));

    while (1) {
        int c;

        static struct option long_options[] = {
                { .name = "port",     .has_arg = 1, .val = 'p' },
                { .name = "ib-dev",   .has_arg = 1, .val = 'd' },
                { .name = "ib-port",  .has_arg = 1, .val = 'i' },
                { .name = "window",   .has_arg = 1, .val = 'r' },
                { .name = "gid-idx",  .has_arg = 1, .val = 'g' },
                { 0 }
        };

        c = getopt_long(argc, argv, "p:d:i:r:g:", long_options, NULL);
        if (c == -1)
            break;

        switch (c) {
        case 'p':
            port = strtol(optarg, NULL, 0);
            if (port < 0 || port > 65535) {
                usage(argv[0]);
                return 1;
            }
            break;

        case 'd':
            ib_devname = strdup(optarg);
            break;

        case 'i':
            ib_port = strtol(optarg, NULL, 0);
            if (ib_port < 0) {
                usage(argv[0]);
                return 1;
            }
            break;

        case 'r':
            window = strtol(optarg, NULL, 0);
            if (window <= 0) {
                usage(argv[0]);
                return 1;
            }
            break;

        case 'g':
            gidx = strtol(optarg, NULL, 0);
            break;

        default:
            usage(argv[0]);
            return 1;
        }
    }

    if (optind == argc - 1)
        servername = strdup(argv[optind]);
    else if (optind < argc) {
        usage(argv[0]);
        return 1;
    }

    page_size = sysconf(_SC_PAGESIZE);

    dev_list = ibv_get_device_list(NULL);
    if (!dev_list) {
        perror("Failed to get IB devices list");
        return 1;
    }

    if (!ib_devname) {
        ib_dev = *dev_list;
        if (!ib_dev) {
            fprintf(stderr, "No IB devices found\n");
            return 1;
        }
    } else {
        int i;
        for (i = 0; dev_list[i]; ++i)
            if (!strcmp(ibv_get_device_name(dev_list[i]), ib_devname))
                break;
        ib_dev = dev_list[i];
        if (!ib_dev) {
            fprintf(stderr, "IB device %s not found\n", ib_devname);
            return 1;
        }
    }

    ctx = bw_init_ctx(ib_dev, ib_port, window, !servername);
    if (!ctx)
        return 1;

    /* The whole control receive pool is posted before the handshake, so no
     * control message can ever find the RQ empty (ADR-0001). */
    if (bw_post_control_recvs(ctx)) {
        fprintf(stderr, "Couldn't post control receives\n");
        return 1;
    }

    if (ibv_query_port(ctx->context, ib_port, &ctx->portinfo)) {
        fprintf(stderr, "Couldn't get port info\n");
        return 1;
    }

    my_dest.lid = ctx->portinfo.lid;
    if (ctx->portinfo.link_layer == IBV_LINK_LAYER_INFINIBAND && !my_dest.lid) {
        fprintf(stderr, "Couldn't get local LID\n");
        return 1;
    }

    if (gidx >= 0) {
        if (ibv_query_gid(ctx->context, ib_port, gidx, &my_dest.gid)) {
            fprintf(stderr, "Could not get local gid for gid index %d\n", gidx);
            return 1;
        }
    } else
        memset(&my_dest.gid, 0, sizeof my_dest.gid);

    my_dest.qpn = ctx->qp->qp_num;
    my_dest.psn = lrand48() & 0xffffff;

    /* The path MTU comes from the port's active MTU, so large messages use
     * the largest packets the link allows. */
    if (servername)
        rem_dest = bw_exch_dest_client(servername, port, &my_dest);
    else {
        /* The server advertises its buffer — the client's RDMA WRITEs land
         * here — and nothing else beyond the template's QP address. */
        my_dest.buf_addr = (uint64_t) ctx->buf;
        my_dest.rkey = ctx->mr->rkey;
        rem_dest = bw_exch_dest_server(ctx, ib_port, ctx->portinfo.active_mtu,
                                       port, &my_dest, gidx);
    }

    if (!rem_dest)
        return 1;

    if (servername)
        if (bw_connect_qp(ctx, ib_port, my_dest.psn, ctx->portinfo.active_mtu,
                          rem_dest, gidx))
            return 1;

    /* Connectivity established: both QPs in RTS. T2 exits cleanly here; the
     * data path lands in later stages. */
    {
        int rc = bw_close_ctx(ctx);

        free(rem_dest);
        ibv_free_device_list(dev_list);
        return rc;
    }
}
