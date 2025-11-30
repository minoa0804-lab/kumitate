// ゲーム状態管理
const game = {
    stage: 1,
    score: 0,
    startTime: null,
    timerInterval: null,
    currentPuzzle: null,
    gridSize: 3,
    canComplete: true // 現在のパズルが完成可能かどうか
};

// パズルの色パターン
const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
    '#16a085'
];

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

// 初期化
function init() {
    createGrid();
    generatePuzzle();
    startTimer();
    updateDisplay();
    
    investigateBtn.addEventListener('click', handleInvestigate);
    dismissBtn.addEventListener('click', handleDismiss);
    nextBtn.addEventListener('click', nextStage);
}

// グリッドの作成
function createGrid() {
    placementArea.innerHTML = '';
    for (let i = 0; i < game.gridSize * game.gridSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;
        
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        cell.addEventListener('dragleave', handleDragLeave);
        
        placementArea.appendChild(cell);
    }
}

// パズル生成
function generatePuzzle() {
    const totalPieces = game.gridSize * game.gridSize;
    
    // ランダムで完成可能かどうかを決定（70%の確率で完成可能）
    game.canComplete = Math.random() < 0.7;
    
    if (game.canComplete) {
        // 完成可能なパズルを生成
        game.currentPuzzle = generateCompletablePuzzle();
    } else {
        // 完成不可能なパズルを生成
        game.currentPuzzle = generateIncompletablePuzzle();
    }
    
    renderPieces();
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
    piecesArea.innerHTML = '';
    
    game.currentPuzzle.forEach(piece => {
        const pieceElement = document.createElement('div');
        pieceElement.className = `puzzle-piece ${piece.used ? 'used' : ''}`;
        pieceElement.style.backgroundColor = piece.color;
        pieceElement.textContent = piece.number;
        pieceElement.draggable = !piece.used;
        pieceElement.dataset.pieceId = piece.id;
        
        if (!piece.used) {
            pieceElement.addEventListener('dragstart', handleDragStart);
            pieceElement.addEventListener('dragend', handleDragEnd);
        }
        
        piecesArea.appendChild(pieceElement);
    });
}

// ドラッグ&ドロップ処理
let draggedPiece = null;

function handleDragStart(e) {
    draggedPiece = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
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
    
    const cell = e.currentTarget;
    
    // すでにピースがある場合は何もしない
    if (cell.children.length > 0) {
        return;
    }
    
    // ピースをセルに配置
    const pieceId = parseInt(draggedPiece.dataset.pieceId);
    const piece = game.currentPuzzle[pieceId];
    
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
    cell.innerHTML = '';
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
    const placedColors = Array.from(cells).map(cell => {
        const piece = cell.querySelector('.puzzle-piece');
        return piece ? piece.style.backgroundColor : null;
    });
    
    // 全ての色が異なるかチェック
    const uniqueColors = new Set(placedColors);
    return uniqueColors.size === placedColors.length && !placedColors.includes(null);
}

// 補充捜査
function handleInvestigate() {
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
        
        // 新しい色に変更
        piece.color = colors[Math.floor(Math.random() * colors.length)];
        piece.number = Math.floor(Math.random() * 99) + 1;
    }
    
    renderPieces();
    
    // スコアにペナルティ（10秒追加）
    game.score += 10000;
}

// 不起訴
function handleDismiss() {
    stopTimer();
    const elapsed = Date.now() - game.startTime;
    
    resultModal.classList.remove('hidden');
    resultTitle.textContent = '❌ 不起訴';
    resultTitle.className = 'dismissal';
    
    if (!game.canComplete) {
        resultMessage.textContent = '正解！このパズルは完成できませんでした。';
    } else {
        resultMessage.textContent = '残念！このパズルは完成可能でした。';
        game.score += 30000; // ペナルティ
    }
    
    resultTime.textContent = `経過時間: ${formatTime(elapsed)}`;
    game.score += elapsed;
    updateDisplay();
}

// 公判請求
function handleIndictment() {
    stopTimer();
    const elapsed = Date.now() - game.startTime;
    
    resultModal.classList.remove('hidden');
    resultTitle.textContent = '✅ 公判請求';
    resultTitle.className = 'indictment';
    resultMessage.textContent = 'おめでとうございます！パズルを完成させました！';
    resultTime.textContent = `経過時間: ${formatTime(elapsed)}`;
    
    game.score += elapsed;
    updateDisplay();
}

// 次のステージ
function nextStage() {
    game.stage++;
    resultModal.classList.add('hidden');
    
    // グリッドをクリア
    const cells = placementArea.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('filled');
    });
    
    // 新しいパズルを生成
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
    timerDisplay.textContent = formatTime(elapsed);
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const deciseconds = Math.floor((ms % 1000) / 100);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${deciseconds}`;
}

// 表示更新
function updateDisplay() {
    scoreDisplay.textContent = game.score;
    stageDisplay.textContent = game.stage;
}

// ゲーム開始
init();
