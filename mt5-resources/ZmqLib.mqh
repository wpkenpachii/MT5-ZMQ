#property copyright "Copyright 2026, wpkenpachii"
#property strict

#import "libzmq.dll"
    long zmq_ctx_new();
    int  zmq_ctx_term(long context);
    long zmq_socket(long context, int type);
    int  zmq_close(long socket);
    int  zmq_connect(long socket, uchar &endpoint[]);
    int  zmq_send(long socket, uchar &buf[], int len, int flags);
    int  zmq_recv(long socket, uchar &buf[], int len, int flags);
    int  zmq_setsockopt(long socket, int option, const uchar &optval[], int optvallen);
#import

#define ZMQ_PUB 1
#define ZMQ_SUB 2
#define ZMQ_SUBSCRIBE 6
#define ZMQ_DONTWAIT 1

class CZmqManager {
private:
    long ctx, sock_pub, sock_sub;

public:
    CZmqManager() : ctx(0), sock_pub(0), sock_sub(0) {}
    ~CZmqManager() { 
        if(sock_pub > 0) zmq_close(sock_pub);
        if(sock_sub > 0) zmq_close(sock_sub);
        if(ctx > 0) zmq_ctx_term(ctx);
    }

    bool Init(string addr_pub, string addr_sub) {
        ctx = zmq_ctx_new();
        if(ctx <= 0) return false;
        sock_pub = zmq_socket(ctx, ZMQ_PUB);
        uchar p_buf[]; StringToCharArray(addr_pub, p_buf, 0, -1, CP_UTF8);
        if(zmq_connect(sock_pub, p_buf) != 0) return false;
        sock_sub = zmq_socket(ctx, ZMQ_SUB);
        uchar filter[] = {0}; 
        if(zmq_setsockopt(sock_sub, ZMQ_SUBSCRIBE, filter, 0) != 0) return false;
        uchar s_buf[]; StringToCharArray(addr_sub, s_buf, 0, -1, CP_UTF8);
        return (zmq_connect(sock_sub, s_buf) == 0);
    }

    int Send(string text) {
        if(sock_pub <= 0) return -1;
        uchar data[];
        int len = StringToCharArray(text, data, 0, WHOLE_ARRAY, CP_UTF8);
        return zmq_send(sock_pub, data, len - 1, ZMQ_DONTWAIT);
    }

    string Read() {
        uchar buf[65536]; 
        ArrayInitialize(buf, 0);
        int res = zmq_recv(sock_sub, buf, 65536, ZMQ_DONTWAIT); 
        return (res > 0) ? CharArrayToString(buf, 0, res, CP_UTF8) : "";
    }
};