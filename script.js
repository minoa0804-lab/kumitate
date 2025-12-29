// ゲーム状態管理
const game = {
    stage: 1,
    score: 0,
    startTime: null,
    timerInterval: null,
    currentPuzzle: null,
    gridSize: 3,
    canComplete: true, // 現在のパズルが完成可能かどうか
    leftNumbers: [], // 左グリッドに表示する必要番号(9個)
    timeLimit: isMobile() ? 45000 : 30000, // モバイル45秒、PC30秒
    isGameOver: false // ゲームオーバーフラグ
};

// モバイルデバイス判定
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// パズルの色パターン
const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
    '#16a085'
];

// 証拠ラベル（1～12）
const evidenceLabels = [
    '',           // 0 (未使用)
    '目撃者',     // 1
    '防犯カメラ', // 2
    '凶器',       // 3
    '指紋',       // 4
    'GPS',        // 5
    '鑑定書',     // 6
    '通話履歴',   // 7
    'SNS',        // 8
    '供述調書',   // 9
    '実況見分',   // 10
    '秘密の暴露', // 11
    '被害届'      // 12
];

// ラベル取得（改行処理付き）
function getEvidenceLabel(num) {
    const label = evidenceLabels[num] || '';
    // 4文字以上の場合、2文字ずつ改行
    if (label.length > 3) {
        const mid = Math.ceil(label.length / 2);
        return label.substring(0, mid) + '\n' + label.substring(mid);
    }
    return label;
}

// DOM要素
const placementArea = document.getElementById('placement-area');
const piecesArea = document.getElementById('pieces-area');
const timerDisplay = document.getElementById('timer');
const scoreDisplay = document.getElementById('score');
const stageDisplay = document.getElementById('stage');
const investigateBtn = document.getElementById('investigate-btn');
const dismissBtn = document.getElementById('dismiss-btn');
const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const resultTime = document.getElementById('result-time');
const nextBtn = document.getElementById('next-btn');
const titleScreen = document.getElementById('title-screen');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');

// 初期化
function init() {
    // スタートボタンのイベントリスナー
    startBtn.addEventListener('click', startGame);

    investigateBtn.addEventListener('click', handleInvestigate);
    dismissBtn.addEventListener('click', handleDismiss);
    nextBtn.addEventListener('click', nextStage);
}

// ゲーム開始
function startGame() {
    // タイトル画面を非表示、ゲーム画面を表示
    titleScreen.style.display = 'none';
    gameContainer.style.display = 'block';

    // タイマー表示を初期化
    timerDisplay.textContent = formatTime(game.timeLimit);

    // 左側の必要番号を初期生成
    game.leftNumbers = sampleNineFromTwelve();
    createGrid();
    generatePuzzle();
    startTimer();
    updateDisplay();
}

// グリッドの作成（左：3x3、薄い数字ガイド）
function createGrid() {
    placementArea.innerHTML = '';
    for (let i = 0; i < game.gridSize * game.gridSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;
        // 左側はランダム選出した 1〜12 の9個を表示
        const requiredNumber = game.leftNumbers[i];
        cell.dataset.requiredNumber = requiredNumber;
        const hint = document.createElement('div');
        hint.className = 'hint-number';
        hint.textContent = getEvidenceLabel(requiredNumber);
        hint.style.whiteSpace = 'pre-line';
        cell.appendChild(hint);

        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        cell.addEventListener('dragleave', handleDragLeave);

        placementArea.appendChild(cell);
    }
    // 右側スロット（4x3）
    createRightSlots();
}

function createRightSlots() {
    piecesArea.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const slot = document.createElement('div');
        slot.className = 'piece-slot';
        piecesArea.appendChild(slot);
    }
}

// パズル生成
function generatePuzzle() {
    // 右側は 1〜12 の数字からランダムに9個選ぶ
    const selected = sampleNineFromTwelve();

    // 完成可能判定：右の9個集合が左の9個集合と一致
    const leftSet = new Set(game.leftNumbers);
    const rightSet = new Set(selected);
    game.canComplete = leftSet.size === rightSet.size && [...leftSet].every(n => rightSet.has(n));

    // ピース生成（色は適当に割当）
    game.currentPuzzle = selected.map((num, idx) => ({
        id: idx,
        color: colors[idx % colors.length],
        number: num,
        used: false
    }));

    renderPieces();
}

// 1〜12から重複なしで9個をランダム選出
function sampleNineFromTwelve() {
    const numbers = Array.from({ length: 12 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers.slice(0, 9);
}

// 完成可能なパズル生成
function generateCompletablePuzzle() {
    const pieces = [];
    const usedColors = colors.slice(0, game.gridSize * game.gridSize);

    // シャッフル
    for (let i = usedColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [usedColors[i], usedColors[j]] = [usedColors[j], usedColors[i]];
    }

    usedColors.forEach((color, index) => {
        pieces.push({
            id: index,
            color: color,
            number: index + 1,
            correctPosition: index,
            used: false
        });
    });

    return pieces;
}

// 完成不可能なパズル生成
function generateIncompletablePuzzle() {
    const pieces = [];
    const totalPieces = game.gridSize * game.gridSize;

    // いくつかの色を重複させて、必要な色を欠落させる
    const availableColors = colors.slice(0, totalPieces);
    const puzzlePieces = [];

    // ランダムに重複を作成
    for (let i = 0; i < totalPieces; i++) {
        if (Math.random() < 0.3 && puzzlePieces.length > 0) {
            // 既存のピースを重複
            const duplicateIndex = Math.floor(Math.random() * puzzlePieces.length);
            puzzlePieces.push({ ...puzzlePieces[duplicateIndex] });
        } else {
            // 新しいピース
            const colorIndex = Math.floor(Math.random() * availableColors.length);
            puzzlePieces.push({
                color: availableColors[colorIndex],
                number: i + 1
            });
        }
    }

    // シャッフル
    for (let i = puzzlePieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [puzzlePieces[i], puzzlePieces[j]] = [puzzlePieces[j], puzzlePieces[i]];
    }

    return puzzlePieces.map((piece, index) => ({
        id: index,
        color: piece.color,
        number: piece.number,
        used: false
    }));
}

// ピースの描画
function renderPieces() {
    // 右側の12スロットを再作成し、ピースを詰めて配置
    createRightSlots();
    const slots = piecesArea.querySelectorAll('.piece-slot');
    let slotIndex = 0;

    game.currentPuzzle.forEach(piece => {
        const pieceElement = document.createElement('div');
        pieceElement.className = `puzzle-piece ${piece.used ? 'used' : ''}`;
        pieceElement.style.backgroundColor = piece.color;
        pieceElement.textContent = getEvidenceLabel(piece.number);
        pieceElement.style.whiteSpace = 'pre-line';
        pieceElement.dataset.pieceId = piece.id;
        pieceElement.dataset.evidenceNumber = piece.number;

        if (!piece.used) {
            if (isMobile()) {
                // モバイル用：クリックのみ
                pieceElement.addEventListener('click', handlePieceClick);
            } else {
                // PC用：ドラッグ&ドロップ
                pieceElement.draggable = true;
                pieceElement.addEventListener('dragstart', handleDragStart);
                pieceElement.addEventListener('dragend', handleDragEnd);
            }
        }

        // 空きスロットに配置
        while (slotIndex < slots.length && slots[slotIndex].children.length > 0) {
            slotIndex++;
        }
        if (slotIndex < slots.length) {
            slots[slotIndex].appendChild(pieceElement);
            slotIndex++;
        }
    });
}

// モバイル用：クリックでピース移動
function handlePieceClick(e) {
    if (game.isGameOver) return;

    const pieceElement = e.currentTarget;
    const pieceId = parseInt(pieceElement.dataset.pieceId);
    const piece = game.currentPuzzle[pieceId];

    // 対応する左側の空きセルを探す
    const cells = placementArea.querySelectorAll('.grid-cell');
    let targetCell = null;

    for (const cell of cells) {
        // すでに埋まっているセルはスキップ
        if (cell.querySelector('.puzzle-piece')) continue;

        const required = parseInt(cell.dataset.requiredNumber, 10);
        if (required === piece.number) {
            targetCell = cell;
            break;
        }
    }

    // 対応するセルがあれば移動処理
    if (targetCell) {
        const placedPiece = document.createElement('div');
        placedPiece.className = 'puzzle-piece';
        placedPiece.style.backgroundColor = piece.color;
        placedPiece.textContent = getEvidenceLabel(piece.number);
        placedPiece.style.whiteSpace = 'pre-line';
        placedPiece.dataset.evidenceNumber = piece.number;
        placedPiece.addEventListener('click', () => removePiece(targetCell, pieceId));

        targetCell.appendChild(placedPiece);
        targetCell.classList.add('filled');

        piece.used = true;
        renderPieces();
        checkCompletion();
    }
}

// ドラッグ&ドロップ処理
let draggedPiece = null;
let touchStartX = 0;
let touchStartY = 0;

function handleDragStart(e) {
    draggedPiece = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

// タッチイベントハンドラ
let touchClone = null;

function handleTouchStart(e) {
    e.preventDefault();
    draggedPiece = e.target;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // クローンを作成してドラッグ中の表示に使用
    touchClone = draggedPiece.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.zIndex = '9999';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.opacity = '0.8';
    touchClone.style.width = draggedPiece.offsetWidth + 'px';
    touchClone.style.height = draggedPiece.offsetHeight + 'px';
    document.body.appendChild(touchClone);

    draggedPiece.classList.add('dragging');
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!draggedPiece || !touchClone) return;

    const touch = e.touches[0];

    // クローンを指の位置に移動
    touchClone.style.left = (touch.clientX - touchClone.offsetWidth / 2) + 'px';
    touchClone.style.top = (touch.clientY - touchClone.offsetHeight / 2) + 'px';
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (!draggedPiece) return;

    const touch = e.changedTouches[0];

    // クローンを削除
    if (touchClone) {
        touchClone.remove();
        touchClone = null;
    }

    draggedPiece.classList.remove('dragging');

    // タッチ位置の要素を取得
    const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = dropTarget?.closest('.grid-cell');

    if (cell && !game.isGameOver) {
        // 既にピースがあるかチェック
        if (cell.querySelector('.puzzle-piece')) {
            draggedPiece = null;
            return;
        }

        const pieceId = parseInt(draggedPiece.dataset.pieceId);
        const piece = game.currentPuzzle[pieceId];
        const required = parseInt(cell.dataset.requiredNumber, 10);

        // 番号一致チェック
        if (piece.number !== required) {
            draggedPiece = null;
            return;
        }

        // ピースを配置
        const placedPiece = document.createElement('div');
        placedPiece.className = 'puzzle-piece';
        placedPiece.style.backgroundColor = piece.color;
        placedPiece.textContent = getEvidenceLabel(piece.number);
        placedPiece.style.whiteSpace = 'pre-line';
        placedPiece.dataset.evidenceNumber = piece.number;
        placedPiece.addEventListener('click', () => removePiece(cell, pieceId));

        cell.appendChild(placedPiece);
        cell.classList.add('filled');

        piece.used = true;
        renderPieces();
        checkCompletion();
    }

    draggedPiece = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (game.isGameOver) return;

    const cell = e.currentTarget;

    // すでにピースが置かれている場合は何もしない（ヒントは無視）
    if (cell.querySelector('.puzzle-piece')) {
        return;
    }

    // ピースをセルに配置
    const pieceId = parseInt(draggedPiece.dataset.pieceId);
    const piece = game.currentPuzzle[pieceId];

    // 番号一致チェック（左は 1〜9 の対応）
    const required = parseInt(cell.dataset.requiredNumber, 10);
    if (piece.number !== required) {
        // 不一致ならドロップ不可
        return;
    }

    const placedPiece = draggedPiece.cloneNode(true);
    placedPiece.draggable = false;
    placedPiece.addEventListener('click', () => removePiece(cell, pieceId));

    cell.appendChild(placedPiece);
    cell.classList.add('filled');

    // 元のピースを使用済みにする
    piece.used = true;
    renderPieces();

    // グリッドが全て埋まったかチェック
    checkCompletion();
}

// ピースの削除（クリックで元に戻す）
function removePiece(cell, pieceId) {
    const placed = cell.querySelector('.puzzle-piece');
    if (placed) {
        placed.remove();
    }
    cell.classList.remove('filled');

    const piece = game.currentPuzzle[pieceId];
    piece.used = false;
    renderPieces();
}

// 完成チェック
function checkCompletion() {
    const cells = placementArea.querySelectorAll('.grid-cell');
    const allFilled = Array.from(cells).every(cell => cell.children.length > 0);

    if (!allFilled) return;

    // すべてのセルが埋まっている場合、正しい配置かチェック
    const isCorrect = checkCorrectPlacement();

    if (isCorrect) {
        // 公判請求
        setTimeout(() => {
            handleIndictment();
        }, 500);
    }
}

// 正しい配置のチェック
function checkCorrectPlacement() {
    const cells = placementArea.querySelectorAll('.grid-cell');
    return Array.from(cells).every(cell => {
        const piece = cell.querySelector('.puzzle-piece');
        const required = parseInt(cell.dataset.requiredNumber, 10);
        const placed = piece ? parseInt(piece.dataset.evidenceNumber, 10) : null;
        return placed === required;
    });
}

// 補充捜査
function handleInvestigate() {
    if (game.isGameOver) return;

    // 使用されていないピースをランダムに変更
    const unusedPieces = game.currentPuzzle.filter(p => !p.used);

    if (unusedPieces.length === 0) {
        alert('全てのピースが使用されています。');
        return;
    }

    // ランダムに1-3個のピースを変更
    const changeCount = Math.min(
        Math.floor(Math.random() * 3) + 1,
        unusedPieces.length
    );

    for (let i = 0; i < changeCount; i++) {
        const randomIndex = Math.floor(Math.random() * unusedPieces.length);
        const piece = unusedPieces[randomIndex];
        // 新しい色＆番号（1〜12）に変更
        piece.color = colors[Math.floor(Math.random() * colors.length)];
        piece.number = Math.floor(Math.random() * 12) + 1;
    }

    renderPieces();
}

// 不起訴
function handleDismiss() {
    const elapsed = Date.now() - game.startTime;

    // 10秒経過前の不起訴はゲームオーバー
    if (elapsed < 10000) {
        handleGameOver('捜査不十分！最低10秒は捜査を尽くす必要があります。');
        return;
    }

    // まだ配置可能なピースがある場合はゲームオーバー
    if (canStillPlacePieces()) {
        handleGameOver('配置可能な証拠があります！捜査を続けてください。');
        return;
    }

    stopTimer();

    resultModal.classList.remove('hidden');
    resultTitle.textContent = '不起訴';
    resultTitle.className = 'dismissal';

    if (!game.canComplete) {
        resultMessage.textContent = '正解！このパズルは完成できませんでした。';
    } else {
        resultMessage.textContent = '残念！このパズルは完成可能でした。';
        game.score += 30000; // ペナルティ
    }

    resultTime.textContent = `経過時間: ${formatTime(game.timeLimit - (Date.now() - game.startTime))}`;
    game.score += elapsed;
    updateDisplay();
}

// ゲームオーバー処理
function handleGameOver(message) {
    game.isGameOver = true;
    stopTimer();

    resultModal.classList.remove('hidden');
    resultTitle.textContent = 'ゲームオーバー';
    resultTitle.className = 'game-over';
    resultMessage.textContent = message;
    resultTime.textContent = '適正な捜査を心がけましょう。';

    // 次のステージボタンを「最初から」に変更
    nextBtn.textContent = '最初からやり直す';
    nextBtn.onclick = () => location.reload();
}

// 配置可能なピースがあるかチェック
function canStillPlacePieces() {
    const unusedPieces = game.currentPuzzle.filter(p => !p.used);
    if (unusedPieces.length === 0) return false;

    // 空いているセルを取得
    const cells = placementArea.querySelectorAll('.grid-cell');
    const emptyCells = Array.from(cells).filter(cell => !cell.querySelector('.puzzle-piece'));

    if (emptyCells.length === 0) return false;

    // 未使用ピースと空きセルの番号が一致するものがあるかチェック
    for (const piece of unusedPieces) {
        for (const cell of emptyCells) {
            const required = parseInt(cell.dataset.requiredNumber, 10);
            if (piece.number === required) {
                return true;
            }
        }
    }

    return false;
}

// 公判請求
function handleIndictment() {
    if (game.isGameOver) return;

    stopTimer();
    const elapsed = Date.now() - game.startTime;
    const remaining = game.timeLimit - elapsed;

    resultModal.classList.remove('hidden');
    resultTitle.textContent = '公判請求';
    resultTitle.className = 'indictment';
    resultMessage.textContent = 'パズルを完成させました！';
    resultTime.textContent = `残り時間: ${formatTime(remaining)}`;

    game.score += elapsed;
    updateDisplay();
}

// 次のステージ
function nextStage() {
    game.stage++;
    game.isGameOver = false;
    resultModal.classList.add('hidden');

    // ボタンテキストを元に戻す
    nextBtn.textContent = '次のステージへ';
    nextBtn.onclick = nextStage;

    // 左側の必要番号を再生成してグリッドを再構築
    game.leftNumbers = sampleNineFromTwelve();
    createGrid();

    // 新しいパズルを生成（右側9個）
    generatePuzzle();
    game.startTime = Date.now();
    startTimer();
    updateDisplay();
}

// タイマー
function startTimer() {
    game.startTime = Date.now();
    game.timerInterval = setInterval(updateTimer, 100);
}

function stopTimer() {
    if (game.timerInterval) {
        clearInterval(game.timerInterval);
        game.timerInterval = null;
    }
}

function updateTimer() {
    const elapsed = Date.now() - game.startTime;
    const remaining = game.timeLimit - elapsed;

    if (remaining <= 0) {
        // タイムアップ
        handleGameOver('タイムアップ！制限時間内に判断できませんでした。');
        return;
    }

    // 残り時間を表示（赤字で警告）
    timerDisplay.textContent = formatTime(remaining);
    if (remaining < 5000) {
        timerDisplay.style.color = '#e74c3c';
    } else {
        timerDisplay.style.color = '#333';
    }
}

function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const deciseconds = Math.floor((Math.max(0, ms) % 1000) / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${deciseconds}`;
}

// 表示更新
function updateDisplay() {
    scoreDisplay.textContent = game.score;
    stageDisplay.textContent = game.stage;
}

// ゲーム開始
init();

// 画面向きチェック（モバイルのみ）
if (isMobile()) {
    const orientationNotice = document.getElementById('orientation-notice');

    function checkOrientation() {
        if (window.innerHeight > window.innerWidth) {
            // 縦向き
            orientationNotice.style.display = 'flex';
        } else {
            // 横向き
            orientationNotice.style.display = 'none';
        }
    }

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
}
