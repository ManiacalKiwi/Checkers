'use strict';

console.log('checkers app.js loaded');

(function () {
  function init() {
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
    const capREl  = document.getElementById('capRed');
    const capBEl  = document.getElementById('capBlack');
    const resetBtn = document.getElementById('reset');
    const flipBtn  = document.getElementById('flip');

    
    let board, turn, selected = null, legalTargets = [], orientation = 'red', chainLock = null;
    let capturedByRed = [], capturedByBlack = [];

    function startingBoard(){
      const b = Array.from({length:8}, () => Array(8).fill(null));
      for (let r = 0; r < 3; r++){
        for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = { color: 'b', king: false };
      }
      for (let r = 5; r < 8; r++){
        for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = { color: 'r', king: false };
      }
      return b;
    }

    function reset(){
      board = startingBoard();
      turn = 'r';
      selected = null; legalTargets = []; chainLock = null;
      capturedByRed = []; capturedByBlack = [];
      render();
    }

    function render(){
      boardEl.innerHTML = '';
      const rows = orientation === 'red' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
      const cols = orientation === 'red' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();

      for (const r of rows){
        for (const c of cols){
          const el = document.createElement('div');
          el.className = 'square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
          el.dataset.r = r; el.dataset.c = c;

          const piece = board[r][c];
          if (piece) el.appendChild(renderPiece(piece));

          if (selected && selected.r === r && selected.c === c) el.classList.add('selected');

          const hint = legalTargets.find(m => m.r === r && m.c === c);
          if (hint){
            if (board[r][c]) el.classList.add('capture');
            else { const dot = document.createElement('div'); dot.className = 'hint'; el.appendChild(dot); }
          }

          el.addEventListener('click', onSquareClick);
          boardEl.appendChild(el);
        }
      }

      const t = turn === 'r' ? 'Red' : 'Black';
      statusEl.textContent = chainLock ? `${t} to move — continue jump` : `${t} to move`;

      capREl.innerHTML = capturedByRed.map(renderMiniPiece).join('');
      capBEl.innerHTML = capturedByBlack.map(renderMiniPiece).join('');
    }

    function renderPiece(p){
      const wrap = document.createElement('div');
      wrap.className = 'piece ' + (p.color === 'r' ? 'red' : 'black');
      if (p.king){
        const k = document.createElement('div');
        k.className = 'crown';
        k.textContent = '\u265B';
        wrap.appendChild(k);
      }
      return wrap;
    }

    function renderMiniPiece(p){
      const bg = p.color === 'r' ? 'linear-gradient(#ff6b6b,#d62828)' : 'linear-gradient(#4b5563,#111827)';
      return `<div style="width:22px;height:22px;border-radius:50%;background:${bg};display:inline-flex;align-items:center;justify-content:center;margin:2px;">${p.king ? '\u265B' : ''}</div>`;
    }

    function onSquareClick(e){
      const r = +e.currentTarget.dataset.r;
      const c = +e.currentTarget.dataset.c;
      if (((r + c) % 2) === 0) return; 

      const piece = board[r][c];

      if (!selected){
        if (piece && piece.color === turn){
          if (chainLock && (r !== chainLock.r || c !== chainLock.c)) return;
          selected = { r, c };
          legalTargets = getLegalMoves(r, c);
        }
      } else {
        if (selected.r === r && selected.c === c){
          selected = null; legalTargets = [];
        } else {
          const move = legalTargets.find(m => m.r === r && m.c === c);
          if (move){
            const madeCapture = !!move.capture;
            doMove(selected.r, selected.c, r, c, move);

            const nowPiece = board[r][c];
            const promoted = maybePromote(r, nowPiece);

            if (madeCapture && !promoted){
              const moreCaps = getCapturesFor(r, c).length > 0;
              if (moreCaps){
                chainLock   = { r, c };
                selected    = { r, c };
                legalTargets = getCapturesFor(r, c);
                render();
                return;
              }
            }

            chainLock = null; selected = null; legalTargets = [];
            turn = (turn === 'r' ? 'b' : 'r');

            const winner = getWinner();
            if (winner){ alert(`${winner === 'r' ? 'Red' : 'Black'} wins!`); }
          } else {
            if (piece && piece.color === turn){
              if (chainLock && (r !== chainLock.r || c !== chainLock.c)) return;
              selected = { r, c };
              legalTargets = getLegalMoves(r, c);
            } else {
              selected = null; legalTargets = [];
            }
          }
        }
      }
      render();
    }

    function doMove(r1, c1, r2, c2, move){
      const p = board[r1][c1];
      if (move.capture){
        const { capR, capC } = move;
        const captured = board[capR][capC];
        if (captured){
          if (p.color === 'r') capturedByRed.push(captured); else capturedByBlack.push(captured);
        }
        board[capR][capC] = null;
      }
      board[r2][c2] = { ...p };
      board[r1][c1] = null;
    }

    function maybePromote(r, p){
      if (!p) return false;
      const atBack = (p.color === 'r' && r === 0) || (p.color === 'b' && r === 7);
      if (atBack && !p.king){ p.king = true; return true; }
      return false;
    }

    function getWinner(){
      const reds = countColor('r');
      const blacks = countColor('b');
      if (reds === 0) return 'b';
      if (blacks === 0) return 'r';
      const rHas = playerHasAnyMoves('r');
      const bHas = playerHasAnyMoves('b');
      if (!rHas) return 'b';
      if (!bHas) return 'r';
      return null;
    }

    function countColor(color){
      let n = 0;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c]?.color === color) n++;
      return n;
    }

    function playerHasAnyMoves(color){
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++){
        const p = board[r][c];
        if (p && p.color === color){ if (getLegalMoves(r, c).length > 0) return true; }
      }
      return false;
    }

    function getLegalMoves(r, c){
      const p = board[r][c]; if (!p) return [];
      if (chainLock && (r !== chainLock.r || c !== chainLock.c)) return [];

      const mustCapture = anyCaptureAvailableFor(turn);
      const captures = getCapturesFor(r, c);
      if (mustCapture){ return captures; }
      return getSlidesFor(r, c);
    }

    function anyCaptureAvailableFor(color){
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++){
        const p = board[r][c];
        if (p && p.color === color){ if (getCapturesFor(r, c).length > 0) return true; }
      }
      return false;
    }

    function dirsFor(p){
      if (p.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
      return p.color === 'r' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]; // red moves up, black moves down
    }

    function inBounds(r, c){ return r >= 0 && r < 8 && c >= 0 && c < 8; }

    function getSlidesFor(r, c){
      const p = board[r][c]; if (!p) return [];
      const res = [];
      for (const [dr, dc] of dirsFor(p)){
        const rr = r + dr, cc = c + dc;
        if (inBounds(rr, cc) && !board[rr][cc]) res.push({ r: rr, c: cc, capture: false });
      }
      return res;
    }

    function getCapturesFor(r, c){
      const p = board[r][c]; if (!p) return [];
      const res = [];
      for (const [dr, dc] of dirsFor(p)){
        const mr = r + dr, mc = c + dc;
        const lr = r + 2*dr, lc = c + 2*dc;
        if (inBounds(lr, lc) && inBounds(mr, mc)){
          const mid = board[mr][mc];
          if (mid && mid.color !== p.color && !board[lr][lc]){
            res.push({ r: lr, c: lc, capture: true, capR: mr, capC: mc });
          }
        }
      }
      return res;
    }

    resetBtn.addEventListener('click', reset);
    flipBtn.addEventListener('click', () => {
      orientation = (orientation === 'red' ? 'black' : 'red');
      render();
    });

    reset(); 
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();