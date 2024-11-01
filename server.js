import e from "express";
import o from "path";
import { Server as r } from "socket.io";
import t from "http";
let __dirname = o.resolve() + "/",
  __viewroot = o.join(__dirname, "/public/views"),
  app = e();
app.use("/public", e.static(__dirname + "/public")),
  app.get("/", (e, o) => {
    o.sendFile("index.html", { root: __viewroot });
  });
let httpServer = t.createServer(app),
  wsServer = new r(httpServer),
  publicRoom = [];
function getJoinedRoomName(e) {
  return Array.from(e.rooms)[1];
}
function getPublicRoom(e) {
  return publicRoom.find((o) => o.name == e);
}
function findSocketByID(e) {
  return wsServer.sockets.sockets.get(e);
}
function countRoom(e) {
  return wsServer.sockets.adapter.rooms.get(e).size;
}
function checkDuplicateRoomName(e) {
  return !wsServer.sockets.adapter.rooms.get(e);
}
function emitPlayerChange(e) {
  wsServer.in(e.name).emit("player_change", {
    blackPlayer: e.blackPlayer,
    whitePlayer: e.whitePlayer,
  }),
    "" !== e.blackPlayer &&
      "" !== e.whitePlayer &&
      ((e.takes = []), findSocketByID(e.blackPlayer).emit("player_select"));
}
function enterRoom(e, o) {
  let r = getPublicRoom(o);
  if ((console.log(`Socket ${e.id} is entering room ${o}.`), void 0 === r)) {
    e.emit("error", "정상적인 방이 아닙니다.");
    return;
  }
  e.join(o),
    e.emit("room_enter", r),
    wsServer.to(o).emit("message", `${e.id} 님이 입장하셨습니다.`);
}
function leaveRoom(e) {
  let o = getJoinedRoomName(e);
  if ((console.log(`Socket ${e.id} is leaving room ${o}.`), void 0 != o)) {
    if (1 == countRoom(o))
      console.log(`Remove room ${o}`),
        (publicRoom = publicRoom.filter((e) => e.name != o)),
        wsServer.sockets.emit("room_list", publicRoom);
    else {
      let r = getPublicRoom(o);
      r.blackPlayer === e.id
        ? ((r.blackPlayer = ""), emitPlayerChange(r))
        : r.whitePlayer === e.id && ((r.whitePlayer = ""), emitPlayerChange(r)),
        wsServer.to(o).emit("message", `${e.id} 님이 퇴장하셨습니다.`);
    }
    e.leave(o);
  }
}
function checkOmokCompleted(e, o) {
  return [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
  ].some((r) => {
    let t = 1,
      i = (o.length - 1) % 2;
    for (
      let l = e.x + r.x, a = e.y + r.y;
      l > 0 &&
      l < 19 &&
      a > 0 &&
      a < 19 &&
      o.some((e, o) => e.x == l && e.y == a && o % 2 == i);
      l += r.x, a += r.y
    )
      t++;
    for (
      let m = e.x - r.x, n = e.y - r.y;
      m > 0 &&
      m < 19 &&
      n > 0 &&
      n < 19 &&
      o.some((e, o) => e.x == m && e.y == n && o % 2 == i);
      m -= r.x, n -= r.y
    )
      t++;
    if (5 === t) return !0;
  });
}
wsServer.on("connection", (e) => {
  e.onAny((e) => {
    console.log(`Socket event: ${e}`);
  }),
    e.on("room_list", () => {
      e.emit("room_list", publicRoom);
    }),
    e.on("room_new", (o) => {
      if (
        ((o = o.trim()),
        console.log(`Socket ${e.id} is creating room ${o}.`),
        e.rooms.size > 1)
      ) {
        console.log(`socket ${e.id} is already in room.`),
          console.log(e.rooms),
          e.emit("error", "이미 다른 방에 참가중입니다.");
        return;
      }
      if (!checkDuplicateRoomName(o)) {
        console.log(`Room name ${o} already exists.`),
          e.emit("error", "동일한 방이 이미 존재합니다.");
        return;
      }
      let r = { name: "room", blackPlayer: "", whitePlayer: "", takes: [] };
      (r.name = o),
        publicRoom.push(r),
        wsServer.sockets.emit("room_list", publicRoom),
        enterRoom(e, o);
    }),
    e.on("room_enter", (o) => {
      if (e.rooms.size > 1) {
        console.log(`socket ${e.id} is already in room.`),
          console.log(e.rooms),
          e.emit("error", "이미 다른 방에 참가중입니다.");
        return;
      }
      enterRoom(e, o);
    }),
    e.on("room_leave", () => {
      leaveRoom(e), e.emit("room_leave");
    }),
    e.on("player_change", (o) => {
      let r = getJoinedRoomName(e),
        t = getPublicRoom(r);
      if ("black" === o) {
        if ("" !== t.blackPlayer) {
          e.emit("error", "다른 플레이어가 참가중입니다.");
          return;
        }
        t.whitePlayer === e.id && (t.whitePlayer = ""), (t.blackPlayer = e.id);
      } else if ("white" === o) {
        if ("" !== t.whitePlayer) {
          e.emit("error", "다른 플레이어가 참가중입니다.");
          return;
        }
        t.blackPlayer === e.id && (t.blackPlayer = ""), (t.whitePlayer = e.id);
      } else if ("spectator" === o) {
        if (t.blackPlayer === e.id) t.blackPlayer = "";
        else {
          if (t.whitePlayer !== e.id) return;
          t.whitePlayer = "";
        }
      }
      emitPlayerChange(t);
    }),
    e.on("player_selected", (o) => {
      let r = getJoinedRoomName(e),
        t = getPublicRoom(r);
      if (void 0 === t) {
        console.log(`Room ${r} is not existing.`);
        return;
      }
      let i = t.takes.length % 2 == 0;
      if (i) {
        if (t.blackPlayer !== e.id) {
          e.emit("error", "흑돌 플레이어가 아닙니다.");
          return;
        }
      } else if (t.whitePlayer !== e.id) {
        e.emit("error", "백돌 플레이어가 아닙니다.");
        return;
      }
      if (
        void 0 === findSocketByID(t.blackPlayer) ||
        void 0 === findSocketByID(t.whitePlayer)
      ) {
        e.emit("error", "상대가 존재하지 않습니다.");
        return;
      }
      if (void 0 !== t.takes.find((e) => e.x === o.x && e.y === o.y)) {
        e.emit("error", "이미 다른 돌이 위치하고 있습니다."),
          e.emit("player_select");
        return;
      }
      if (
        (t.takes.push(o),
        wsServer.in(r).emit("player_selected", o),
        checkOmokCompleted(o, t.takes))
      ) {
        console.log("Omok completed!"),
          wsServer.in(r).emit("game_end", i ? "black" : "white"),
          wsServer.in(r).emit("message", `${e.id}님이 승리하셨습니다!`),
          (t.blackPlayer = ""),
          (t.whitePlayer = ""),
          emitPlayerChange(t);
        return;
      }
      i
        ? findSocketByID(t.whitePlayer).emit("player_select")
        : findSocketByID(t.blackPlayer).emit("player_select");
    }),
    e.on("player_ready", () => {}),
    e.on("disconnecting", () => {
      console.log(`Socket ${e.id} is disconnecting.`), leaveRoom(e);
    });
}),
  httpServer.listen(3e3, () => {
    console.log("Example app listening on port 3000");
  });
