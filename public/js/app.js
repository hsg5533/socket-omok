const socket = io();

function Mobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
const isMobile = Mobile();

socket.onAny((event) => {
  console.log(`Socket event: ${event}`);
});

socket.on("error", (message) => {
  alert(message);
});

const Header = () => {
  return <h1 className="title">Socket Omok</h1>;
};

const NewRoom = () => {
  const handleNewRoom = (event) => {
    event.preventDefault();
    const name = event.target.roomname.value;
    event.target.roomname.value = "";
    if (name.length == 0) return;
    socket.emit("room_new", name);
  };

  return (
    <div className="newroom">
      <form className="newroom__form" onSubmit={handleNewRoom}>
        <input
          className="newroom__input"
          type="text"
          name="roomname"
          placeholder="방 이름"
        ></input>
        <button className="newroom__submit">방 만들기</button>
      </form>
    </div>
  );
};

const RoomItem = (room) => {
  const handleEnterRoom = () => {
    socket.emit("room_enter", room.name);
  };

  return (
    <li key={room.name} className="room-list__item">
      <p className="room-list__name">{room.name}</p>
      <button className="room-list__enter" onClick={handleEnterRoom}>
        입장하기
      </button>
    </li>
  );
};

const RoomList = ({ roomList }) => {
  return (
    <div className="room-list">
      <h3>방 목록</h3>
      <ul className="room-list__container">{roomList.map(RoomItem)}</ul>
    </div>
  );
};

const WaitingRoom = () => {
  const [roomList, setRoomList] = React.useState([]);
  document.title = `대기실: 참가 가능한 방 ${roomList.length}개`;
  React.useEffect(() => {
    socket.on("room_list", (list) => {
      console.log(list);
      setRoomList(list);
    });
    socket.emit("room_list");

    return () => {
      socket.off("room_list");
    };
  }, []);

  return (
    <div className="waiting-room">
      <NewRoom />
      <RoomList roomList={roomList} />
    </div>
  );
};

const BOARD_OFFSET = 3.62; //%
const BOARD_SPACE = 5.14; //%
//크기: 5%
//칸: 5.14%
//공백: 3.62%
const stone = ({ type, x, y }) => {
  let material = "";
  type.forEach((m) => {
    switch (m) {
      case "black":
        material += " omokboard__stone--black";
        break;
      case "white":
        material += " omokboard__stone--white";
        break;
      case "hint":
        material += " omokboard__stone--hint";
        break;
      case "prev":
        material += " omokboard__stone--prev";
        break;
    }
  });

  return (
    <div
      className={`omokboard__stone ${material}`}
      key={`${x}${y}`}
      style={{
        left: `${x * BOARD_SPACE + BOARD_OFFSET}%`,
        top: `${y * BOARD_SPACE + BOARD_OFFSET}%`,
      }}
    ></div>
  );
};

const MemoriedStone = React.memo(stone);

const CoordSelectArea = ({
  onBoardEnter,
  onBoardMove,
  onBoardLeave,
  onBoardSelect,
}) => {
  function getCoord(event) {
    let coordX = 0;
    let coordY = 0;

    if (!isMobile) {
      const percentX =
        (event.nativeEvent.offsetX * 100.0) / event.target.clientWidth;
      const percentY =
        (event.nativeEvent.offsetY * 100.0) / event.target.clientHeight;

      coordX = parseInt((percentX - BOARD_OFFSET) / BOARD_SPACE + 0.5);
      coordY = parseInt((percentY - BOARD_OFFSET) / BOARD_SPACE + 0.5);
    } else {
      const bcr = event.target.getBoundingClientRect();
      const x = event.targetTouches[0].clientX - bcr.x;
      const y = event.targetTouches[0].clientY - bcr.y;

      const percentX = (x * 100.0) / event.target.clientWidth;
      const percentY = (y * 100.0) / event.target.clientHeight;
      coordX = parseInt((percentX - BOARD_OFFSET) / BOARD_SPACE + 0.5);
      coordY = parseInt((percentY - BOARD_OFFSET) / BOARD_SPACE - 1.5);
    }

    if (coordX < 0) coordX = 0;
    if (coordY < 0) coordY = 0;

    if (coordX > 18) coordX = 18;
    if (coordY > 18) coordY = 18;

    return {
      x: coordX,
      y: coordY,
    };
  }

  const onMouseEnter = () => {
    if (isMobile) return;
    onBoardEnter();
  };

  const onMouseMove = (event) => {
    if (isMobile) return;
    onBoardMove(getCoord(event));
  };

  const onMouseLeave = () => {
    if (isMobile) return;
    onBoardLeave();
  };

  const onMouseClick = () => {
    if (isMobile) return;
    onBoardSelect();
  };

  const onTouchStart = (event) => {
    if (!isMobile) return;
    onBoardEnter();
    onBoardMove(getCoord(event));
  };

  const onTouchMove = (event) => {
    if (!isMobile) return;
    onBoardMove(getCoord(event));
  };

  const onTouchEnd = (event) => {
    if (!isMobile) return;
    onBoardLeave();
    onBoardSelect();
  };

  return (
    <div
      className="omokboard__coord"
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onMouseClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    ></div>
  );
};

const OmokBoard = ({ takes }) => {
  const [inBoard, setInBoard] = React.useState(false);
  const [myTurn, setMyTurn] = React.useState(false);
  const [coord, setCoord] = React.useState({});
  const [isGameEnd, setGameEnd] = React.useState(false);

  React.useState(() => {
    socket.on("player_select", () => {
      setMyTurn(true);
    });

    socket.on("player_change", () => {
      setMyTurn(false);
    });
  }, []);

  const handleBoardEnter = () => {
    setInBoard(true);
  };

  const handleBoardLeave = () => {
    setInBoard(false);
  };

  const handleBoardMove = (coord) => {
    //이미 돌이 존재하면 건너뜀
    if (takes.find((c) => c.x === coord.x && c.y === coord.y) === undefined) {
      setCoord(coord);
    }
  };

  const handleBoardSelect = () => {
    setMyTurn(false);
    console.log(`Select [${coord.x},${coord.y}]`);
    socket.emit("player_selected", coord);
  };

  return (
    <div className="omokboard">
      {myTurn ? (
        <CoordSelectArea
          onBoardEnter={handleBoardEnter}
          onBoardMove={handleBoardMove}
          onBoardLeave={handleBoardLeave}
          onBoardSelect={handleBoardSelect}
        />
      ) : null}
      {takes.map((takes, index) => (
        <MemoriedStone
          type={[index % 2 === 0 ? "black" : "white"]}
          x={takes.x}
          y={takes.y}
        />
      ))}
      {takes.length > 0 ? (
        <MemoriedStone
          type={["prev"]}
          x={takes[takes.length - 1].x}
          y={takes[takes.length - 1].y}
        />
      ) : null}
      {myTurn && inBoard ? (
        <MemoriedStone
          type={[takes.length % 2 == 0 ? "black" : "white", "hint"]}
          x={coord.x}
          y={coord.y}
        />
      ) : null}
    </div>
  );
};

const GamePanel = ({ roomname, blackPlayer, whitePlayer }) => {
  const [message, setMessage] = React.useState([]);

  React.useEffect(() => {
    socket.on("message", (msg) => {
      setMessage((value) => [...value, msg]);
    });
  }, []);

  const Player = ({ name, onClick }) => {
    return (
      <div className="game-panel__playerinfo">
        {name !== "" ? (
          <p className="game-panel__playername">{name}</p>
        ) : (
          <button className="game-panel__playerselect" onClick={onClick}>
            참가
          </button>
        )}
      </div>
    );
  };

  const MessageLine = (msg) => {
    return (
      <>
        {msg}
        <br />
      </>
    );
  };

  const blackPlayerCallback = () => {
    socket.emit("player_change", "black");
  };

  const whitePlayerCallback = () => {
    socket.emit("player_change", "white");
  };

  return (
    <div className="game-panel">
      <div className="game-panel__main">
        <h3 className="game-panel__title">{roomname}</h3>
        <div className="game-panel__players">
          <div className="game-panel__player">
            <h4 className="game-panel__playercolor game-panel__playercolor--black">
              Black
            </h4>
            <Player name={blackPlayer} onClick={blackPlayerCallback} />
          </div>
          <div className="game-panel__player">
            <h4 className="game-panel__playercolor game-panel__playercolor--white">
              White
            </h4>
            <Player name={whitePlayer} onClick={whitePlayerCallback} />
          </div>
        </div>
        <div className="game-panel__message">
          <p>{message.map(MessageLine)}</p>
        </div>
      </div>
      <div className="game-panel__buttons">
        <button
          className="game-panel__button"
          onClick={() => socket.emit("player_change", "spectator")}
        >
          관전하기
        </button>
        <button
          className="game-panel__button"
          onClick={() => {
            socket.emit("room_leave");
          }}
        >
          방 나가기
        </button>
      </div>
    </div>
  );
};

const GamingRoom = ({ publicRoom }) => {
  const [roomName, setRoomName] = React.useState(publicRoom.name);
  const [blackPlayer, setBlackPlayer] = React.useState(publicRoom.blackPlayer);
  const [whitePlayer, setWhitePlayer] = React.useState(publicRoom.whitePlayer);
  const [takes, setTakes] = React.useState(publicRoom.takes);

  const [winner, setWinner] = React.useState("");

  console.log(publicRoom);
  document.title = `공개방: ${roomName}`;

  const onGameEnd = () => {
    setWinner("");
  };

  const GameEndScreen = ({ winner }) => {
    const text = `${winner === "black" ? "흑돌" : "백돌"} 승리!`;
    return (
      <div className="endscreen">
        <div className="endscreen__main">
          <h3 className="endscreen__text">{text}</h3>
          <button className="endscreen__button" onClick={onGameEnd}>
            확인
          </button>
        </div>
      </div>
    );
  };

  React.useEffect(() => {
    socket.on("player_change", ({ blackPlayer, whitePlayer }) => {
      setBlackPlayer(blackPlayer);
      setWhitePlayer(whitePlayer);
      if (blackPlayer !== "" && whitePlayer !== "") {
        setTakes([]);
      }
    });

    socket.on("player_selected", (coord) => {
      console.log(`player_selected [${coord.x},${coord.y}]`);
      console.log(takes);
      setTakes((t) => [...t, coord]);
    });

    socket.on("game_end", (winner) => {
      setWinner(winner);
    });
  }, []);

  return (
    <div className="gaming-room">
      <OmokBoard takes={takes} />
      <GamePanel
        roomname={roomName}
        blackPlayer={blackPlayer}
        whitePlayer={whitePlayer}
      />
      {winner !== "" ? <GameEndScreen winner={winner} /> : null}
    </div>
  );
};

const App = () => {
  const [publicRoom, setPublicRoom] = React.useState({});

  React.useEffect(() => {
    socket.on("room_enter", (room) => {
      console.log(`Enter room ${room.name}`);
      setPublicRoom(room);
    });

    socket.on("room_leave", () => {
      setPublicRoom({});
    });
  }, []);

  return (
    <>
      <Header />
      {publicRoom.name === undefined ? (
        <WaitingRoom />
      ) : (
        <GamingRoom publicRoom={publicRoom} />
      )}
    </>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
