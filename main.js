crosswordEl = "#the-crossword"
cluesAcrossEl = "#clues-across";
cluesDownEl = "#clues-down";
blackButtonEl = "#black-button";
playButtonEl = "#play-button";

timerEl = "#timer";
toolbarEl = "#toolbar";
editorToolsEl = "#editor-tools";

playModalEl = "#play-modal";
confirmPlayButtonEl = ".confirm-play-button";
youWinModalEl = "#you-win-modal";
confirmWinButtonEl = "#confirm-win-button";
shareButtonEl = "#share-button";
shareModalEl = "#share-modal";
shareLinkEl = "#share-link";
copyShareLinkButtonEl = "#copy-share-link-button";

playOthersModalEl = "#play-others-modal";

SIZE = 5;

selectedCell = undefined;

playing = false;
targetBoard = undefined;

BLANK = "";
BLACK = "BLACK";

board = [];
numbers = [];
for (var i = 0; i < SIZE; i++) {
  var row = [];
  var row_numbers = [];
  for (var j = 0; j < SIZE; j++) {
    row.push(BLANK);
    row_numbers.push(0);
  }
  board.push(row);
  numbers.push(row_numbers);
}
console.log(numbers);

ACROSS = 0;
DOWN = 1;
clues = [{}, {}];

/* Cell numbering */
function leftEdge(r, c) {
  return c == 0 || board[r][c-1] == BLACK;
}
function topEdge(r, c) {
  return r == 0 || board[r-1][c] == BLACK;
}
function numberifyCells() {
  var newClues = [{}, {}];
  num = 1;
  for (var r = 0; r < SIZE; r++) {
    for (var c = 0; c < SIZE; c++) {
      value = board[r][c];
      if (value == BLACK) {
        numbers[r][c] = 0;
        continue;
      }
      CLUE_FILLER = "Click to edit clue.";
      if (leftEdge(r, c) && topEdge(r, c)) {
        newClues[ACROSS][num] = clues[ACROSS][num] || CLUE_FILLER;
        newClues[DOWN][num] = clues[DOWN][num] ||CLUE_FILLER;
        numbers[r][c] = num;
        num += 1;
      } else if (leftEdge(r, c)) {
        newClues[ACROSS][num] = clues[ACROSS][num] || CLUE_FILLER;
        numbers[r][c] = num;
        num += 1;
      } else if (topEdge(r, c)) {
        newClues[DOWN][num] = clues[DOWN][num] || CLUE_FILLER;
        numbers[r][c] = num;
        num += 1;
      } else {
        numbers[r][c] = 0;
      }
    }
  }
  clues[ACROSS] = newClues[ACROSS];
  clues[DOWN] = newClues[DOWN];
}

function fillCellRC(r, c, value) {
  $cell = $("#" + r + c);
  fillCell($cell, value);
}
function fillCell($cell, value) {
  var html = "<div class='cell-char'>" + value + "</div>";
  $cell.html(html);
  $($cell.children()[0]).fitText(0.1);
}
function updateCell(r, c) {
  $cell = $("#" + r + c);
  $cell.html("");
  if (selectedCell && $cell.attr('id') == selectedCell.attr('id')) {
    var $htmlSelect = $("<div class='cell-select'></div>");
    $cell.append($htmlSelect);
  }
  if (board[r][c] == BLACK) {
    $cell.addClass("cell-black");
    return
  }
  $cell.removeClass("cell-black");
  var $htmlChar = $("<div class='cell-char'>" + board[r][c] + "</div>");
  $cell.append($htmlChar);
  $htmlChar.fitText(0.12);
  if (numbers[r][c] != 0) {
    var $htmlNum = $("<div class='cell-num'>" + numbers[r][c] + "</div>");
    $cell.append($htmlNum);
    $htmlNum.fitText(0.1);
  }
}
function updateCells() {
  numberifyCells();
  for (var r = 0; r < SIZE; r++) {
    for (var c = 0; c < SIZE; c++) {
      updateCell(r, c);
    }
  }
  $(blackButtonEl).prop("disabled", selectedCell === undefined);
  if (selectedCell && selectedCell.hasClass("cell-black")) {
    $(blackButtonEl).text("Remove black square");
  } else {
    $(blackButtonEl).text("Make black square")
  }
}

/* Clue creation and update */
function editableDiv(initialValue, dir, num) {
  var $li = $("<div class='editable-clue' style='display: inline-block'>" + initialValue + "</div>");
  var clickFunc = function() {
    if (playing) { return }
    var $textarea = $(document.createElement("input"));
    $textarea.val($(this).html());
    $(this).html($textarea);
    $textarea.focus();
    $textarea.select();
    $(this).off("click");
    leaveFunc = function($thisObj) {
      $thisObj.off("focusout");
      $thisObj.off("keypress");
      clues[dir][num] = $textarea.val();
      $thisObj.html($textarea.val());
      $li.click(clickFunc);
    }
    $(this).focusout(function() {
      leaveFunc($(this));
    });
    $(this).keypress(function(e) {
      if (e.which == 13) { // enter
        leaveFunc($(this));
        return false;
      }
    });
  }
  $li.click(clickFunc);
  return $li;
}
function fillClues(element, direction) {
  var cs = clues[direction];
  var keys = Object.keys(cs).sort();
  var $ul = $(document.createElement("ul"));
  keys.forEach(function(key) {
    var clue = cs[key];
    var $li = $(document.createElement("li"));
    $li.append("<span class='clue-num'>" + key + "&nbsp;&nbsp;</span>");
    $li.append(editableDiv(clue, direction, key));
    $ul.append($li);
  });
  $(element).html($ul);
}
function updateClues() {
  fillClues(cluesAcrossEl, ACROSS);
  fillClues(cluesDownEl, DOWN);
}

/* Cell creation */
for (var i = 0; i < board.length; i++) {
  var $newRow = $("<div class='row'></div>");
  var hPercentStr = (100/SIZE).toString() + "%";
  $newRow.css({width: "100%", height: hPercentStr});
  $(crosswordEl).append($newRow);
  for (var j = 0; j < board.length; j++) {
    var id = "" + i + j;
    var $newCell = $("<div class='cell' id='" + id + "'></div>");
    $newCell.css({width: hPercentStr, height: "100%"});
    $newRow.append($newCell);
  }
}
updateCells();
updateClues();

/* Cell selection */
$("html").click(function(event) {
  $target = $(event.target);
  selectedCell = undefined;
  if ($target.hasClass("cell")) {
    var $cell = $target;
    selectedCell = $cell;
  }
  updateCells();
});
function rcFromCell($cell) {
  return $cell.attr('id');
}
function selectNextCell() {
  if (!selectedCell) { return }
  $(".cell").removeClass("cell-selected");
  var rc = rcFromCell(selectedCell);
  var row = parseInt(rc[0]);
  var col = parseInt(rc[1]);
  col += 1;
  if (col >= SIZE) { col = 0; row += 1; }
  if (row >= SIZE) { selectedCell = undefined; return }
  var $cell = $("#" + row + col);
  $cell.addClass("cell-selected");
  selectedCell = $cell;
}

/* Winning */
function checkForWin() {
  for (var r = 0; r < SIZE; r++) {
    for (var c = 0; c < SIZE; c++) {
      if (board[r][c] != targetBoard[r][c]) {
        return;
      }
    }
  }
  playing = false;
  stopTimer();
  $(toolbarEl).css({"visibility": "visible"});
  $(youWinModalEl).modal();
}
/* Char entry */
$("body").keypress(function(event) {
  var code = event.keyCode || event.which;
  if (code == 9) { // tab
    event.preventDefault();
    selectNextCell();
    updateCells();
    return false;
  }
  var char = String.fromCharCode(code);
  if (selectedCell) {
    var cell_id = selectedCell.attr('id');
    var row = cell_id[0];
    var col = cell_id[1];
    if (char.match(/^[a-zA-Z]{1}$/)) {
      board[row][col] = char.toUpperCase();
      selectNextCell();
    }
    if (code == 8) { // delete
      board[row][col] = BLANK;
    }
    updateCells();
    updateClues();
    if (playing) {
      checkForWin();
    }
  }
});

/* Black squares addition */
$(blackButtonEl).click(function() {
  if (!selectedCell) { return; }
  var rc = rcFromCell(selectedCell);
  var row = rc[0];
  var col = rc[1];
  if (board[row][col] == BLACK) {
    board[row][col] = BLANK;
  } else {
    board[row][col] = BLACK;
  }
  updateCells();
  updateClues();
});

/* Start playing */
function deepCopy(arr) {
  if (!(arr instanceof Array)) {
    return arr;
  } else if (arr.length == 0) {
    return [];
  } else {
    return arr.map(deepCopy);
  }
}

function deepClean(arr) {
  if (!(arr instanceof Array)) {
    if (arr == BLACK) {
      return BLACK;
    } else {
      return BLANK;
    }
  } else if (arr.length == 0) {
    return [];
  } else {
    return arr.map(deepClean);
  }
}

$(playButtonEl).click(function() {
  $(playModalEl).modal();
});

function startPlaying() {
  playing = true;
  targetBoard = deepCopy(board);
  board = deepClean(targetBoard, clean=BLANK);
  updateCells();
  updateClues();
  $(toolbarEl).css({"visibility": "hidden"});
  $.modal.close();
  startTimer(true);
}

$(confirmPlayButtonEl).click(startPlaying);

$(confirmWinButtonEl).click(function() {
  $.modal.close();
})

/* Encode game as url */
function gameToParameter() {
  var gameString = "board=" + JSON.stringify(board) + ";" +
                   "clues=" + JSON.stringify(clues) + ";";
  var encodedGame = window.btoa(gameString);
  return encodedGame;
}
function makeGameURL() {
  var param = encodeURIComponent(gameToParameter());
  var newUrl = window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    '?game=' +
    param;
  return newUrl;
}

/* Share game */

$(shareButtonEl).click(function() {
  $(shareLinkEl).val(makeGameURL());
  $(shareModalEl).modal();
  $(shareLinkEl).focus();
  $(shareLinkEl).select();
});

$(copyShareLinkButtonEl).click(function() {
  $(shareLinkEl).select();
  document.execCommand("Copy");
});

/* Timer */
var t;
var seconds = 0;
var minutes = 0;
var hours = 0;
function add() {
  seconds++;
  if (seconds >= 60) {
    seconds = 0;
    minutes++;
    if (minutes >= 60) {
      minutes = 0;
      hours++;
    }
  }
  $(timerEl).html(
    (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds)
  );
  startTimer(false);
}
function startTimer(reset=false) {
  if (reset) {
    seconds = 0;
    minutes = 0;
    hours = 0;
  }
  t = setTimeout(add, 1000);
}
function stopTimer() {
  clearTimeout(t);
}

/* Loading a game */
var urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('game')) {
  var encodedGame = urlParams.get('game');
  var decodedGame = decodeURIComponent(window.atob(encodedGame));
  eval(decodedGame);
  $(playOthersModalEl).modal();
}
