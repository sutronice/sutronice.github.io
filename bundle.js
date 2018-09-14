(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
Board = require('../models/Board.js');
Clues = require('../models/Clues.js');

CrosswordView = require('../views/CrosswordView.js');

Const = require('../global/Const.js');

NextCellService = require('../services/NextCellService.js');
UrlBuilderService = require('../services/UrlBuilderService.js');

Timer = require('../models/Timer.js');

function CrosswordController() {
  this.size = 5;

  if (this._loadingGame()) {
    var crossword = this._loadCrossword();
    this.board = new Board(this.size, crossword.board);
    this.clues = new Clues(crossword.clues);
    this.authorName = crossword.authorName;
  } else {
    this.board = new Board(this.size);
    this.clues = new Clues();
    this.authorName = "Kim";
  }

  this.selectedCell = undefined;
  this.selectedClueCells = [];
  this.selectedClue = {dir: undefined, num: undefined};

  this.numberify();

  this.nextCellService = new NextCellService(this);

  this.playing = false;
  this.targetBoard = undefined;
  this.timer = new Timer(this.timerTicked.bind(this));

  this.urlBuilderService = new UrlBuilderService(this);

  this.view = new CrosswordView(this, this._loadingGame());
}

/*
 * Actions
 */

CrosswordController.prototype.enterChar = function (char) {
  if (!this.selectedCell) { return; }
  if (this.selectedCell.isBlack()) { return; }
  if (char.match(/^[a-zA-Z]{1}$/)) {
    this.selectedCell.char = char.toUpperCase();
    this.selectNextCell();
  }
  if (this.playing && this._didWin()) {
    this._doWin();
  }
};

CrosswordController.prototype.deleteChar = function () {
  if (this.selectedCell.isBlack()) { return; }
  if (this.selectedCell.isBlank()) {
    this.selectPrevCell();
    return;
  }
  this.selectedCell.char = "";
  if (this.playing && this._didWin()) {
    this._doWin();
  }
};

CrosswordController.prototype.setClueText = function (dir, num, text) {
  this.clues.set(dir, num, text);
};

CrosswordController.prototype.toggleBlack = function (r, c) {
  if (!this.selectedCell) { return; }
  if (this.selectedCell.isBlack()) {
    this.selectedCell.char = "";
  } else {
    this.selectedCell.char = Const.BLACK;
  }
  this.numberify();
};

CrosswordController.prototype.selectCell = function (r, c) {
  this.selectedCell = this.board.cellAt(r, c);
  // select clue for this new cell
  if (this.selectedCell.isBlack()) {
    this.deselectClue();
    return;
  }
  var dir = this.selectedClue.dir || Const.ACROSS;
  var selectedCellClue = this._clueForCell(this.selectedCell, dir);
  this.selectClue(selectedCellClue.dir, selectedCellClue.num, false);
};

CrosswordController.prototype.selectClue = function (dir, num, selectCell=true) {
  this.selectedClue.dir = dir;
  this.selectedClue.num = num;
  this.selectedClueCells = this._buildSelectedClueCells(dir, num);
  if (selectCell) {
    var firstCell = this.selectedClueCells.find(c => c.isBlank());
    firstCell = firstCell || this.selectedClueCells[0];
    this.selectCell(firstCell.r, firstCell.c);
  }
};
CrosswordController.prototype.deselectClue = function () {
  this.selectedClue.dir = undefined;
  this.selectedClue.num = undefined;
  this.selectedClueCells = [];
};

CrosswordController.prototype.selectNextCell = function() {
  this.nextCellService.nextCell();
}
CrosswordController.prototype.selectPrevCell = function() {
  this.nextCellService.prevCell();
}

CrosswordController.prototype.selectNextClue = function() {
  this.nextCellService.nextClue();
}

CrosswordController.prototype.isCellSelected = function(r, c) {
  return this.selectedCell &&
         this.selectedCell.r == r &&
         this.selectedCell.c == c;
}

CrosswordController.prototype.rotateSelectedClueDirection = function() {
  if (this.selectedCell.isBlack()) { return; }
  var dir = this.selectedClue.dir == Const.ACROSS ? Const.DOWN : Const.ACROSS;
  var selectedCellClue = this._clueForCell(this.selectedCell, dir);
  this.selectClue(selectedCellClue.dir, selectedCellClue.num, false);
}

CrosswordController.prototype.startPlaying = function () {
  this.playing = true;
  this.targetBoard = this.board.copy();
  this.board = this.board;
  this.board.clearCharacters();
  this.view.updateTimer(0, 0);
  this.timer.start(reset=true);
  if (this.playing && this._didWin()) {
    this._doWin();
  }
}

CrosswordController.prototype.stopPlaying = function () {
  if (!this.playing) { return; }
  this.playing = false;
  this.board = this.targetBoard;
  this.targetBoard = undefined;
  this.timer.stop();
}

CrosswordController.prototype.clearBoard = function () {
  this.board = new Board(this.size);
  this.clues = new Clues();
  this.numberify();
}

/*
 * View helpers
 */

CrosswordController.prototype.getCells = function () {
  return this.board.rows;
};

CrosswordController.prototype.getClues = function (dir) {
  return this.clues.inDirection(dir);
};

CrosswordController.prototype.cellIsBlack = function (r, c) {
  return this.board.cellAt(r, c).isBlack();
};

CrosswordController.prototype.getShareUrl = function (callback) {
  this.urlBuilderService.url(function(shortURL) {
    callback(shortURL);
  });
};

/*
 * State
 */

CrosswordController.prototype.numberify = function () {
  var oldClues = this.clues;
  var newClues = new Clues();

  var CLUE_FILLER = "Click to edit clue.";

  var cell;
  num = 1;
  for (var r = 0; r < this.size; r++) {
    for (var c = 0; c < this.size; c++) {
      cell = this.board.cellAt(r, c);
      if (cell.isBlack()) {
        cell.number = 0;
        continue;
      }
      if (this.board.leftEdge(r, c) && this.board.topEdge(r, c)) {
        newClues.set(Const.ACROSS, num, oldClues.get(Const.ACROSS, num) || CLUE_FILLER);
        newClues.set(Const.DOWN, num, oldClues.get(Const.DOWN, num) || CLUE_FILLER);
        cell.number = num;
        num += 1;
      } else if (this.board.leftEdge(r, c)) {
        newClues.set(Const.ACROSS, num, oldClues.get(Const.ACROSS, num) || CLUE_FILLER);
        cell.number = num;
        num += 1;
      } else if (this.board.topEdge(r, c)) {
        newClues.set(Const.DOWN, num, oldClues.get(Const.DOWN, num) || CLUE_FILLER);
        cell.number = num;
        num += 1;
      } else {
        cell.number = 0;
      }
    }
  }
  this.clues = newClues;
  this.deselectClue();
}

CrosswordController.prototype._buildSelectedClueCells = function (dir, num) {
  var selectedClueCells = [];
  var startCell = this.board.findCellWithNumber(num);
  var r = startCell.r;
  var c = startCell.c;
  if (dir == Const.ACROSS) {
    while (c < this.size && !this.board.cellAt(r, c).isBlack()) {
      selectedClueCells.push(this.board.cellAt(r, c));
      c++;
    }
  } else {
    while (r < this.size && !this.board.cellAt(r, c).isBlack()) {
      selectedClueCells.push(this.board.cellAt(r, c));
      r++;
    }
  }
  return selectedClueCells
}

CrosswordController.prototype._clueForCell = function (cell, dir) {
  var r = cell.r;
  var c = cell.c;
  var num;
  if (dir == Const.ACROSS) {
    while (c > 0 && !this.board.cellAt(r, c - 1).isBlack()) {
      c--;
    }
  } else {
    while (r > 0 && !this.board.cellAt(r - 1, c).isBlack()) {
      r--;
    }
  }
  return {dir: dir, num: this.board.cellAt(r, c).number};
}

CrosswordController.prototype.timerTicked = function (minutes, seconds) {
  this.view.updateTimer(minutes, seconds);
}

CrosswordController.prototype._didWin = function() {
  return Board.equals(this.board, this.targetBoard);
}

CrosswordController.prototype._doWin = function() {
  this.stopPlaying();
  this.view.win();
}

CrosswordController.prototype._loadingGame = function() {
  var urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('game');
}

CrosswordController.prototype._loadCrossword = function() {
  var urlParams = new URLSearchParams(window.location.search);
  var encodedGame = urlParams.get('game');
  var decodedGame = decodeURIComponent(window.atob(encodedGame));
  console.log(decodedGame);
  var game = JSON.parse(decodedGame);
  return game;
}


CrosswordController.prototype.fillExamplePuzzle = function () {
  this.board = new Board(
    this.size,
    [
      ["BLACK", "T", "A", "J", "BLACK"],
      ["C", "A", "R", "E", "T"],
      ["F", "R", "O", "S", "T"],
      ["L", "O", "S", "S", "Y"],
      ["BLACK", "T", "E", "E", "BLACK"],
    ]
  );
  this.clues = new Clues();
  this.clues.set(Const.ACROSS, 1, '"Crown" of the Mahal');
  this.clues.set(Const.ACROSS, 4, 'Shift 6 on your keyboard');
  this.clues.set(Const.ACROSS, 6, 'He took the road less traveled by');
  this.clues.set(Const.ACROSS, 7, 'A compression algorithm that approximates');
  this.clues.set(Const.ACROSS, 8, 'A golf ball sits on this');
  this.clues.set(Const.DOWN, 1, 'Cards for divination');
  this.clues.set(Const.DOWN, 2, 'Stood up');
  this.clues.set(Const.DOWN, 3, 'Pinkman of Breaking Bad');
  this.clues.set(Const.DOWN, 4, 'Replace incandescents with these');
  this.clues.set(Const.DOWN, 5, 'Example output: /dev/ttys001');
  this.numberify();
}

module.exports = CrosswordController;
},{"../global/Const.js":2,"../models/Board.js":4,"../models/Clues.js":6,"../models/Timer.js":7,"../services/NextCellService.js":8,"../services/UrlBuilderService.js":9,"../views/CrosswordView.js":12}],2:[function(require,module,exports){
var Const = {
  BLACK: "BLACK",
  BLANK: "",

  ACROSS: 0,
  DOWN: 1,
}

module.exports = Const;
},{}],3:[function(require,module,exports){
// Interface = require('./crossword/interface.js');
//
// interface = new Interface();

CrosswordController = require('./controllers/CrosswordController.js');

controller = new CrosswordController();
},{"./controllers/CrosswordController.js":1}],4:[function(require,module,exports){
Cell = require('./Cell.js');

function Board(size, initial=undefined) {
  this.size = size;

  this.rows = [];
  for (var r = 0; r < size; r++) {
    var row = [];
    for (var c = 0; c < size; c++) {
      row.push(new Cell(r, c));
      if (initial) { row[c].char = initial[r][c]; }
    }
    this.rows.push(row);
  }
}

Board.prototype.cellAt = function (row, col) {
  return this.rows[row][col];
}

Board.prototype.charAt = function (row, col) {
  return this.rows[row][col].char;
}

Board.prototype.leftEdge = function(row, col) {
  return col == 0 || this.cellAt(row, col-1).isBlack();
}
Board.prototype.topEdge = function(row, col) {
  return row == 0 || this.cellAt(row-1, col).isBlack();
}

Board.prototype.copy = function() {
  var newBoard = new Board(this.size);
  var cell;
  for (var r = 0; r < this.size; r++) {
    for (var c = 0; c < this.size; c++) {
      cell = this.cellAt(r, c);
      newBoard.rows[r][c] = new Cell(r, c, cell.char, cell.number);
    }
  }
  return newBoard;
}

Board.prototype.findCellWithNumber = function(number) {
  var cell;
  for (var r = 0; r < this.size; r++) {
    for (var c = 0; c < this.size; c++) {
      cell = this.cellAt(r, c);
      if (cell.number == number) {
        return cell;
      }
    }
  }
  return "no cell";
}

Board.prototype.clearCharacters = function() {
  var cell;
  for (var r = 0; r < this.size; r++) {
    for (var c = 0; c < this.size; c++) {
      cell = this.cellAt(r, c);
      if (cell.isBlack()) { continue; }
      cell.char = "";
    }
  }
}

Board.prototype.raw = function() {
  var rawBoard = [];
  for (var r = 0; r < this.size; r++) {
    var row = [];
    for (var c = 0; c < this.size; c++) {
      row.push(this.charAt(r, c));
    }
    rawBoard.push(row);
  }
  return rawBoard;
}

/*
 * Static
 */

Board.equals = function(board, targetBoard) {
  if (board.size != targetBoard.size) { return false; }
  for (var r = 0; r < board.size; r++) {
    for (var c = 0; c < board.size; c++) {
      if (!Cell.equals(board.cellAt(r, c), targetBoard.cellAt(r, c))) {
        return false;
      }
    }
  }
  return true;
}

module.exports = Board;
},{"./Cell.js":5}],5:[function(require,module,exports){
Const = require('../global/Const.js');

function Cell(r, c, char="", number=0) {
  this.r = r;
  this.c = c;

  this.char = char;
  this.number = number;
}

Cell.prototype.isBlack = function () {
  return this.char === Const.BLACK;
};

Cell.prototype.isBlank = function () {
  return this.char === Const.BLANK;
};

/*
 * Static
 */

Cell.equals = function(cellA, cellB) {
  return cellA.char === cellB.char;
}

module.exports = Cell;
},{"../global/Const.js":2}],6:[function(require,module,exports){
Const = require('../global/Const.js');

function Clues(initial=undefined) {
  if (initial) {
    this._clues = initial;
  } else {
    // brackets for computed property id
    this._clues = {[Const.ACROSS]: {}, [Const.DOWN]: {}};
  }
}

Clues.prototype.get = function (dir, num) {
  return this._clues[dir][num];
}

Clues.prototype.set = function(dir, num, text) {
  this._clues[dir][num] = text;
}

Clues.prototype.inDirection = function (dir) {
  return this._clues[dir];
}

Clues.prototype.raw = function() {
  return this._clues;
}

module.exports = Clues;
},{"../global/Const.js":2}],7:[function(require,module,exports){
function Timer(tick) {
  this.t;
  this.seconds = 0;
  this.minutes = 0;

  this.tick = tick;
}

Timer.prototype.start = function (reset=false) {
  if (reset) {
    this.seconds = 0;
    this.minutes = 0;
  }
  this.t = setTimeout(Timer.prototype._add.bind(this), 1000);
}

Timer.prototype.stop = function () {
  clearTimeout(this.t);
}

Timer.prototype._add = function () {
  this.seconds++;
  if (this.seconds >= 60) {
    this.seconds = 0;
    this.minutes++;
  }
  this.tick(this.minutes, this.seconds);
  this.start(false);
}

module.exports = Timer;
},{}],8:[function(require,module,exports){
Const = require('../global/Const.js');

function NextCellService(controller) {
  this.controller = controller;
}

NextCellService.prototype.nextCell = function () {
  if (this._curCell() === undefined) { return; }

  if (this._curClue().dir === undefined) {
    var c = (this._curCell().c + 1) % this._size();
    var r = ((c == 0) ? this._curCell().r + 1 : this._curCell().r) % this._size();
    this.controller.selectCell(r, c);
    return;
  }

  var clueCells = this._curClueCells();
  var start = clueCells.indexOf(this._curCell()) + 1;
  var i, candidate;
  for (var k = 0; k < clueCells.length; k++) {
    i = (start + k) % clueCells.length;
    candidate = clueCells[i];
    if (candidate.isBlank()) {
      this.controller.selectCell(candidate.r, candidate.c);
      return;
    }
  }

  // clue is full
}

NextCellService.prototype.prevCell = function () {
  var clueCells = this._curClueCells();
  var curCellIndex = clueCells.indexOf(this._curCell());
  if (curCellIndex == 0) { return; }
  var prevCell = clueCells[curCellIndex - 1];
  this.controller.selectCell(prevCell.r, prevCell.c);
}

NextCellService.prototype.nextClue = function () {
  var curDir = this._curClue().dir;

  var cluesInDir = this._clues().inDirection(curDir);
  var sortedClues = Object.keys(cluesInDir).map(num => parseInt(num));
  var currentIndex = sortedClues.indexOf(this._curClue().num);

  if (currentIndex == sortedClues.length - 1) {
    curDir = (curDir == Const.ACROSS) ? Const.DOWN : Const.ACROSS;
    var cluesInDir = this._clues().inDirection(curDir);
    var sortedClues = Object.keys(cluesInDir).map(num => parseInt(num));
    this.controller.selectClue(curDir, sortedClues[0]);
  } else {
    this.controller.selectClue(curDir, sortedClues[currentIndex + 1]);
  }
}

NextCellService.prototype._curCell = function () {
  return this.controller.selectedCell;
}

NextCellService.prototype._curClue = function () {
  return this.controller.selectedClue;
}

NextCellService.prototype._curClueCells = function () {
  return this.controller.selectedClueCells;
}

NextCellService.prototype._clues = function () {
  return this.controller.clues;
}

NextCellService.prototype._size = function () {
  return this.controller.size;
}

module.exports = NextCellService;
},{"../global/Const.js":2}],9:[function(require,module,exports){
/* Example usage:

  myUrlBuilderService.url(function(shortURL) {
    $(shareLinkEl).val(shortURL);
    $(shareLinkEl).focus();
    $(shareLinkEl).select();
  });

*/

function UrlBuilderService(controller) {
  this.controller = controller;
}

/* Callback: function(shortURL) */
UrlBuilderService.prototype.url = function(callback) {
  this._tinyURLify(this._makeGameURL(), callback);
}

UrlBuilderService.prototype._tinyURLify = function(longURL, callback) {
  $.ajax({
    url: "https://api.steven.codes/shorten_url",
    method: "POST",
    data: {'long_url': longURL},
  }).done(callback);
}

UrlBuilderService.prototype._makeGameURL = function() {
  var param = encodeURIComponent(this._gameToParameter());
  var newUrl = window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    '?game=' +
    param;
  return newUrl;
}

UrlBuilderService.prototype._gameToParameter = function() {
  console.log(this.controller.board.raw());
  console.log(this.controller.clues.raw());
  var gameString = JSON.stringify(
    {
      board: this.controller.board.raw(),
      clues: this.controller.clues.raw(),
      authorName: this.controller.authorName,
    }
  );
  var encodedGame = window.btoa(gameString);
  return encodedGame;
}

module.exports = UrlBuilderService;
},{}],10:[function(require,module,exports){
function CellView(r, c, char, number) {
  this.r = r;
  this.c = c;
  this.char = char;
  this.number = number;

  this.el = undefined;
}

/* The DOM element for this cell. */
CellView.prototype.element = function() {
  if (this.el) { return this.el; }
  this.el = $(
    "<div class='cell' id='" +
    this.r + "-" + this.c +
    "'></div>"
  );
  this.el.data('cellView', this);

  // adding one off cell-char and cell-num.
  // that way don't have to fittext every time.
  // fittext has a memory leak
  var $cellCharHTML = $("<div class='cell-char'></div>");
  $cellCharHTML.fitText(0.11);
  var $cellNumHTML = $("<div class='cell-num'></div>");
  $cellNumHTML.fitText(0.1);

  this.el.append($cellCharHTML);
  this.el.append($cellNumHTML);

  return this.el;
};

CellView.prototype.redraw = function() {
  this._deselectForClue();

  $(this.element().children(".cell-char")[0]).empty();
  $(this.element().children(".cell-num")[0]).empty();

  if (this._isBlack()) {
    this._setBlack();
  } else {
    this._removeBlack();
    $(this.element().children(".cell-char")[0]).html(this.char);
  }
  if (this.number != 0) {
    $(this.element().children(".cell-num")[0]).html(this.number);
  }
}

CellView.prototype.select = function() {
  $(".cell-select").remove();
  var $htmlSelect = $("<div class='cell-select'></div>");
  this.element().append($htmlSelect);
}


CellView.prototype.selectForClue = function () {
  this.element().addClass("cell-select-for-clue");
}
CellView.prototype._deselectForClue = function () {
  this.element().removeClass("cell-select-for-clue");
}

CellView.prototype._isBlack = function () {
  return this.char === Const.BLACK;
}

CellView.prototype._setBlack = function() {
  this.element().addClass("cell-black");
}
CellView.prototype._removeBlack = function() {
  this.element().removeClass("cell-black");
}

module.exports = CellView;
},{}],11:[function(require,module,exports){
function ClueView(dir, num, text) {
  this.dir = dir;
  this.num = num;
  this.text = text;

  this.el = undefined;
  this.input = undefined;
}

ClueView.prototype.element = function () {
  if (this.el) { return this.el }
  this.el = $("<div class='clue' id=" + this.identifier() + "></div>");
  this.el.append("<span class='clue-num'>" + this.num + "&nbsp;&nbsp;</span>");
  this.el.append("<div class='editable-clue' style='display: inline-block'>" + this.text + "</div>");
  this.el.data('clueView', this);
  return this.el;
}

ClueView.prototype.identifier = function () {
  return "clue-" + this.dir + "-" + this.num;
}

ClueView.prototype.startEditing = function () {
  this.element().find('.editable-clue').remove();
  this.input = $(document.createElement("input"));
  this.input.val(this.text);
  this.element().append(this.input);
  this.input.focus();
  this.input.select();
}

ClueView.prototype.updateFromInput = function () {
  this.text = this.input.val();
  this.el.find("input").remove();
  this.el.append("<div class='editable-clue' style='display: inline-block'>" + this.text + "</div>");
  this.input = undefined;
}

ClueView.prototype.select = function () {
  $('.clue').removeClass("clue-select");
  this.el.addClass("clue-select");
}

/*
 * Static
 */

ClueView.deselectAll = function () {
 $('.clue').removeClass("clue-select");
}

module.exports = ClueView;
},{}],12:[function(require,module,exports){
CellView = require('./CellView.js');
ClueView = require('./ClueView.js');

Const = require('../global/Const.js');

function CrosswordView(controller, loadingGame) {
  this.controller = controller;

  this.crosswordContainer = "#crossword-container";
  this.cluesAcrossEl = "#clues-across";
  this.cluesDownEl = "#clues-down";

  this.authorName = "#author-name";
  this.authorModal = "#author-modal";
  this.authorModalInput = "#author-modal-input";
  this.authorModalDoneButton = "#author-modal-done-button";

  this.blackButton = "#black-button";
  this.playButton = "#play-button";
  this.shareButton = "#share-button";
  this.exampleButton = "#example-button";
  this.clearButton = "#clear-button";
  this.clearModal = "#clear-modal";
  this.clearModalButton = "#clear-modal-button";
  this.editorToolbarEl = "#editor-toolbar";
  this.shareModal = "#share-modal";
  this.shareModalLink = "#share-modal-link";
  this.shareModalCopyButton = "#share-modal-copy-button";
  this.shareModalLoader = "#share-modal-loader";
  this.shareModalLoadedItems = "#share-modal-loaded-items";
  this.playFromUrlModal = "#play-from-url-modal";
  this.playFromUrlModalConfirmButton = "#play-from-url-modal-confirm-button";
  this.playFromUrlModalAuthor = "#play-from-url-modal-author";

  this.timerEl = "#timer";
  this.playerToolbarEl = "#player-toolbar";
  this.giveUpButton = "#give-up-button";
  this.youWinModal = "#you-win-modal";
  this.youWinModalTime = "#you-win-modal-time";

  this._cells = [];
  this._clues = undefined;

  this.editedClue = undefined;

  if (loadingGame) {
    var self = this;
    $(this.playFromUrlModal).on($.modal.BEFORE_OPEN, function(event, modal) {
      console.log(self.controller.authorName);
      $(self.playFromUrlModalAuthor).text(self.controller.authorName);
    });

    $("#body").addClass("blur");
    $(this.playFromUrlModal).modal();
  }
  this._construct();
}

CrosswordView.prototype._construct = function () {
  var size = this.controller.size;
  var modelCells = this.controller.getCells();

  // Construct board
  var $crosswordHolder = $("<div id='the-crossword'></div>");
  for (var r = 0; r < size; r++) {
    var $newRow = $("<div class='row'></div>");
    var hPercentStr = (100/size).toString() + "%";
    $newRow.css({width: "100%", height: hPercentStr});
    $crosswordHolder.append($newRow);
    this._cells[r] = [];
    for (var c = 0; c < size; c++) {
      var newCell = new CellView(r, c, modelCells[r][c].char, modelCells[r][c].number);
      this._cells[r][c] = newCell;
      var $newCell = newCell.element();
      $newCell.css({width: hPercentStr, height: "100%"});
      $newRow.append($newCell);
    }
  }
  this._redrawClues();

  $(this.crosswordContainer).append($crosswordHolder);
  // Trigger Fittext
  window.dispatchEvent(new Event('resize'));

  this._updateAuthorName(this.controller.authorName);

  this._redrawCells();
  this._setup_handlers();
  this._toolsEnableCheck();
}

CrosswordView.prototype._setup_handlers = function () {
  var self = this;

  $("html").click(function(event) {
    $target = $(event.target);
    if (!$target.is("input") && self._editingClue()) {
      self._resolveClueEditing();
    }
    if ($target.closest(".clue").length > 0) {
      var $clue = $target.closest(".clue");
      var clueView = $clue.data('clueView');
      if (!self.controller.playing) {
        if (clueView === self.editedClue) { return; }
        self.editedClue = clueView;
        clueView.startEditing();
      }
      self.controller.selectClue(clueView.dir, clueView.num);
      self._drawSelectedClue();
      self._redrawCells();
    }
  });

  $("html").mousedown(function(event) {
    var $target = $(event.target);
    if ($target.hasClass("cell")) {
      var $cell = $target;
      var cellView = $cell.data('cellView');
      if (self.controller.isCellSelected(cellView.r, cellView.c)) {
        self.controller.rotateSelectedClueDirection();
      } else {
        self.controller.selectCell(cellView.r, cellView.c);
      }
      self._redrawCells();
      self._drawSelectedClue();
    }
  });

  $("body").keydown(function(event) {
    var code = event.keyCode || event.which;

    if (code == 9) { // tab
      if ($.modal.isActive()) { return; }
      event.preventDefault();
      self.controller.selectNextClue();
      self._redrawCells();
      self._drawSelectedClue();
      return;
    }

    if (code == 13) { // enter
      if (self._editingClue()) {
        self._resolveClueEditing();
      } else if ($.modal.isActive()) {
        if ($.modal.getCurrent().$elm[0].id === "author-modal") {
          self._updateAuthorName();
          $.modal.close();
        }
      } else {
        self.controller.selectNextClue();
        self._redrawCells();
        self._drawSelectedClue();
      }
      return;
    }

    if (code == 8) { // delete
      if ($.modal.isActive()) { return; }
      if (!self._editingClue()) { // allow focused inputs to delete
        self.controller.deleteChar();
        self._redrawCells();
        return false; // prevent browser back
      }
    }
    if (!self._editingClue()) {
      if ($.modal.isActive()) { return; }
      var char = String.fromCharCode(code);
      self.controller.enterChar(char);
      self._redrawCells();
    }
  });

  /* Buttons */

  $(this.blackButton).click(function() {
    self.controller.toggleBlack();
    self._redrawCells();
    self._redrawClues();
  });

  $(this.playButton).click(function() {
    self.controller.startPlaying();
    self._toolsEnableCheck();
    self._redrawCells();
  });

  $(this.shareButton).click(function() {
    $(self.shareModal).modal();
  });

  $(this.exampleButton).click(function() {
    self.controller.fillExamplePuzzle();
    self._redrawCells();
    self._redrawClues();
  });

  $(this.clearButton).click(function() {
    $(self.clearModal).modal();
  });

  $(this.giveUpButton).click(function() {
    self.controller.stopPlaying();
    self.updateTimer(0, 0);
    self._toolsEnableCheck();
    self._redrawCells();
    self._redrawClues();
  });

  $(this.shareModalCopyButton).click(function() {
    $(self.shareModalLink).select();
    document.execCommand("Copy");
  });

  $(this.authorName).click(function() {
    $(self.authorModal).modal();
  });

  $(this.authorModalDoneButton).click(function() {
    self._updateAuthorName();
    $.modal.close();
  });

  $(this.clearModalButton).click(function() {
    self.controller.clearBoard();
    self._redrawCells();
    self._redrawClues();
  })

  /* Modal events */

  $(this.youWinModal).on($.modal.BEFORE_OPEN, function(event, modal) {
    $(self.youWinModalTime).html($(self.timerEl).html());
  });

  $(this.shareModal).on($.modal.BEFORE_OPEN, function(event, modal) {
    $(self.shareModalLoader).show();
    $(self.shareModalLoadedItems).hide();
    self.controller.getShareUrl(function(url) {
      $(self.shareModalLoader).hide();
      $(self.shareModalLoadedItems).show();
      $(self.shareModalLink).val(url);
      $(self.shareModalLink).focus();
      $(self.shareModalLink).select();
    });
  });

  $(this.authorModal).on($.modal.BEFORE_OPEN, function(event, modal) {
    $(self.authorModalInput).val($(self.authorName).text());
  });

  $(this.authorModal).on($.modal.OPEN, function(event, modal) {
    $(self.authorModalInput).focus();
    $(self.authorModalInput).select();
  });

  $(this.playFromUrlModal).on($.modal.AFTER_CLOSE, function(event, modal) {
    self.controller.startPlaying();
    self._toolsEnableCheck();
    self._redrawCells();
    $("#body").removeClass("blur");
  });
}


CrosswordView.prototype._redrawCells = function () {
  var modelCells = this.controller.getCells();
  var cellView;
  var modelCell;
  for (var r = 0; r < this.controller.size; r++) {
    for (var c = 0; c < this.controller.size; c++) {
      cellView = this._cells[r][c];
      modelCell = modelCells[r][c];
      cellView.char = modelCell.char;
      cellView.number = modelCell.number;
      cellView.redraw();
      if (this.controller.selectedCell &&
          this.controller.selectedCell.r == r &&
          this.controller.selectedCell.c == c) {
        cellView.select();
      }
      if (this.controller.selectedClueCells.includes(modelCell)) {
        cellView.selectForClue();
      }
    }
  }
  this._enableBlackButton();
}

CrosswordView.prototype._redrawClues = function () {
  this._clues = {[Const.ACROSS]: {}, [Const.DOWN]: {}};
  for (var dir in [Const.ACROSS, Const.DOWN]) {
    var clues = this.controller.getClues(dir);
    var $ul = $(document.createElement("ul"));
    var clueText;
    var clueView;
    for (var clueNum in clues) {
      clueText = clues[clueNum];
      clueView = new ClueView(dir, clueNum, clueText);
      this._clues[dir][clueNum] = clueView;
      $ul.append(clueView.element());
    }
    var cluesContainer = dir == Const.ACROSS ? this.cluesAcrossEl : this.cluesDownEl;
    $(cluesContainer).html($ul);
  }
  this._drawSelectedClue();
}

CrosswordView.prototype._editingClue = function () {
  return this.editedClue != undefined;
}

CrosswordView.prototype._resolveClueEditing = function () {
  var clue = this.editedClue;
  clue.updateFromInput();
  this.controller.setClueText(clue.dir, clue.num, clue.text);
  this.editedClue = undefined;
}

CrosswordView.prototype._enableBlackButton = function () {
  $(this.blackButton).prop("disabled", this.controller.selectedCell === undefined);
  var selectedCell = this.controller.selectedCell;
  if (selectedCell && this.controller.cellIsBlack(selectedCell.r, selectedCell.c)) {
    $(this.blackButton).text("Remove black square");
  } else {
    $(this.blackButton).text("Make black square");
  }
}

CrosswordView.prototype._drawSelectedClue = function () {
  if (this.controller.selectedClue.dir == undefined) {
    ClueView.deselectAll();
    return;
  }
  var clueView = this._clues[this.controller.selectedClue.dir][this.controller.selectedClue.num];
  clueView.select();
}

CrosswordView.prototype._toolsEnableCheck = function () {
  var playing = this.controller.playing;
  if (playing) {
    $(this.editorToolbarEl).hide();
    $(this.playerToolbarEl).show();
  } else {
    $(this.editorToolbarEl).show();
    $(this.playerToolbarEl).hide();
  }
}

CrosswordView.prototype._updateAuthorName = function (newName=undefined) {
  if (!newName) {
    newName = $(this.authorModalInput).val();
  }
  if (newName) {
    $(this.authorName).text(newName);
    this.controller.authorName = newName;
  }
}

/*
 * Callable from CrosswordController
 */

CrosswordView.prototype.updateTimer = function(minutes, seconds) {
  $(this.timerEl).html(
    (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds)
  );
}

CrosswordView.prototype.win = function() {
  this._redrawCells();
  this._toolsEnableCheck();
  $(this.youWinModal).modal();
}

module.exports = CrosswordView;
},{"../global/Const.js":2,"./CellView.js":10,"./ClueView.js":11}]},{},[3]);
