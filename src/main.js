/* -------------------------------------------------------------
 * PanTré (パントレ) - main.js
 * フロントエンド全体のコントローラー (SPAルーティング、UI描画、CRUD、D&D)
 * ------------------------------------------------------------- */

// グローバルに読み込まれた定数とdbオブジェクトを使用します

// グローバル状態
let currentCategories = [];
let currentFoodItems = [];
let activePage = 'dashboard';
let swipeStartX = 0;
let dragSourceId = null;

// DOM要素キャッシュ
const el = {
  appNav: document.querySelector('.app-nav'),
  pages: document.querySelectorAll('.app-page'),
  btnSync: document.getElementById('btn-sync'),
  btnUser: document.getElementById('btn-user'),
  fabAddFood: document.getElementById('fab-add-food'),
  
  // Dashboard page
  userDisplayName: document.getElementById('user-display-name'),
  dashboardCategories: document.getElementById('dashboard-categories'),
  dashboardAlerts: document.getElementById('dashboard-alerts'),
  
  // Stock page
  searchStock: document.getElementById('search-stock'),
  stockCategories: document.getElementById('stock-categories'),
  
  // Expiry page
  expiryList: document.getElementById('expiry-list'),
  expiryFilters: document.querySelector('.expiry-filters'),
  
  // Settings page
  settingsDisplayName: document.getElementById('settings-display-name'),
  settingsHouseholdCode: document.getElementById('settings-household-code'),
  btnEditProfile: document.getElementById('btn-edit-profile'),
  btnCopyCode: document.getElementById('btn-copy-code'),
  btnJoinHousehold: document.getElementById('btn-join-household'),
  householdMembersList: document.getElementById('household-members-list'),
  btnManageCategories: document.getElementById('btn-manage-categories'),
  btnManageUnits: document.getElementById('btn-manage-units'),
  dbStatusBadge: document.getElementById('db-status-badge'),
  btnSetupSupabase: document.getElementById('btn-setup-supabase'),
  settingsLogoutSection: document.getElementById('settings-logout-section'),
  btnLogout: document.getElementById('btn-logout'),
  
  // Modals
  modalAuth: document.getElementById('modal-auth'),
  formAuth: document.getElementById('form-auth'),
  authTitle: document.getElementById('auth-title'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authToggleLink: document.getElementById('auth-toggle-link'),
  btnCloseAuth: document.getElementById('btn-close-auth'),
  
  modalFood: document.getElementById('modal-food'),
  formFood: document.getElementById('form-food'),
  foodModalTitle: document.getElementById('food-modal-title'),
  foodId: document.getElementById('food-id'),
  foodName: document.getElementById('food-name'),
  foodCategory: document.getElementById('food-category'),
  foodQuantity: document.getElementById('food-quantity'),
  foodUnit: document.getElementById('food-unit'),
  foodExpiration: document.getElementById('food-expiration'),
  foodMemo: document.getElementById('food-memo'),
  btnCancelFood: document.getElementById('btn-cancel-food'),
  btnCloseFood: document.getElementById('btn-close-food'),
  
  modalSupabase: document.getElementById('modal-supabase'),
  formSupabase: document.getElementById('form-supabase'),
  sbUrl: document.getElementById('sb-url'),
  sbKey: document.getElementById('sb-key'),
  btnDisconnectSupabase: document.getElementById('btn-disconnect-supabase'),
  btnCloseSupabase: document.getElementById('btn-close-supabase'),
  
  modalJoin: document.getElementById('modal-join-household'),
  formJoinHousehold: document.getElementById('form-join-household'),
  joinCode: document.getElementById('join-code'),
  btnCancelJoin: document.getElementById('btn-cancel-join'),
  btnCloseJoin: document.getElementById('btn-close-join'),
  
  modalProfile: document.getElementById('modal-profile'),
  formProfile: document.getElementById('form-profile'),
  profileName: document.getElementById('profile-name'),
  btnCancelProfile: document.getElementById('btn-cancel-profile'),
  btnCloseProfile: document.getElementById('btn-close-profile'),

  toastContainer: document.getElementById('toast-container')
};

// -------------------------------------------------------------
// A. トースト通知ヘルパー
// -------------------------------------------------------------
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'info') icon = 'fa-circle-info';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  el.toastContainer.appendChild(toast);
  
  // 3秒後に自動削除
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

// -------------------------------------------------------------
// B. ルーティング (画面切り替え)
// -------------------------------------------------------------
function navigateTo(pageId) {
  activePage = pageId;
  
  // タブボタンのアクティブクラス更新
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 画面コンテナのフェード表示
  el.pages.forEach(page => {
    if (page.id === `page-${pageId}`) {
      page.style.display = 'block';
      setTimeout(() => page.classList.add('active'), 50);
    } else {
      page.classList.remove('active');
      page.style.display = 'none';
    }
  });

  // ページごとの追加更新処理
  if (pageId === 'dashboard') {
    renderDashboard();
  } else if (pageId === 'stock') {
    renderStockGrid();
  } else if (pageId === 'expiry') {
    renderExpiryList();
  } else if (pageId === 'chat') {
    chatController.init();
  } else if (pageId === 'calendar') {
    calendarController.render();
  } else if (pageId === 'report') {
    reportController.render();
  } else if (pageId === 'settings') {
    renderSettings();
  }
}

// -------------------------------------------------------------
// C. データ取得 & レンダリング
// -------------------------------------------------------------
async function loadAppData(silent = false) {
  if (!silent) {
    el.btnSync.classList.add('spinning');
  }

  try {
    currentCategories = await db.getCategories();
    currentFoodItems = await db.getFoodItems();

    // モーダルのセレクトボックス初期化
    initModalSelects();

    // アクティブ画面の再描画
    navigateTo(activePage);
  } catch (err) {
    console.error('データ読み込みエラー:', err);
    showToast('データの更新に失敗しました', 'error');
  } finally {
    el.btnSync.classList.remove('spinning');
  }
}

function initModalSelects() {
  // カテゴリセレクトボックス
  el.foodCategory.innerHTML = currentCategories.map(cat => 
    `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
  ).join('');

  // 単位セレクトボックス
  el.foodUnit.innerHTML = DEFAULT_UNITS.map(unit => 
    `<option value="${unit}">${unit}</option>`
  ).join('');
}

// 1. ダッシュボード画面の描画
async function renderDashboard() {
  const user = await db.getCurrentUser();
  if (user) {
    el.userDisplayName.textContent = user.user_metadata?.display_name || user.email.split('@')[0];
  } else {
    el.userDisplayName.textContent = '料理担当者';
  }

  // カテゴリ別食材数の集計
  el.dashboardCategories.innerHTML = '';
  currentCategories.forEach(cat => {
    const count = currentFoodItems.filter(item => item.category_id === cat.id).length;
    
    const card = document.createElement('div');
    card.className = 'category-summary-card';
    card.innerHTML = `
      <span class="category-card-icon">${cat.icon}</span>
      <span class="category-card-name">${cat.name}</span>
      <span class="category-card-count">${count} 品</span>
    `;
    card.addEventListener('click', () => {
      // ストック画面に遷移し、そのカテゴリまでスクロール
      navigateTo('stock');
      setTimeout(() => {
        const catSection = document.getElementById(`stock-sec-${cat.id}`);
        if (catSection) {
          catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          catSection.classList.add('drag-over');
          setTimeout(() => catSection.classList.remove('drag-over'), 800);
        }
      }, 300);
    });
    el.dashboardCategories.appendChild(card);
  });

  // 賞味期限アラートの算出
  const alertsContainer = el.dashboardAlerts;
  alertsContainer.innerHTML = '';
  
  const today = new Date();
  today.setHours(0,0,0,0);

  const alertItems = currentFoodItems
    .filter(item => item.expiration_date) // 期限ありのもの
    .map(item => {
      const expDate = new Date(item.expiration_date);
      expDate.setHours(0,0,0,0);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...item, diffDays };
    })
    .filter(item => item.diffDays <= 7) // 7日以内
    .sort((a, b) => a.diffDays - b.diffDays); // 期限短い順

  if (alertItems.length === 0) {
    alertsContainer.innerHTML = `<p class="empty-message">期限が近い食材はありません 🎉</p>`;
    return;
  }

  alertItems.slice(0, 5).forEach(item => {
    const itemCard = document.createElement('div');
    
    let alertClass = 'safe';
    let alertText = `あと ${item.diffDays} 日`;
    
    if (item.diffDays < 0) {
      alertClass = 'expired';
      alertText = `期限切れ (過 ${Math.abs(item.diffDays)} 日)`;
    } else if (item.diffDays === 0) {
      alertClass = 'expired';
      alertText = `今日まで`;
    } else if (item.diffDays <= 3) {
      alertClass = 'warning';
      alertText = `あと ${item.diffDays} 日`;
    }

    itemCard.className = `alert-item ${alertClass}`;
    
    const emoji = getFoodEmoji(item.name);
    
    itemCard.innerHTML = `
      <div class="alert-item-info">
        <span class="alert-item-emoji">${emoji}</span>
        <div class="alert-item-details">
          <span class="alert-item-name">${item.name}</span>
          <span class="alert-item-qty">${item.quantity} ${item.unit}</span>
        </div>
      </div>
      <span class="alert-item-days">${alertText}</span>
    `;

    itemCard.addEventListener('click', () => openFoodModal(item));
    alertsContainer.appendChild(itemCard);
  });
}

// 2. 食材ストック画面の描画
function renderStockGrid() {
  const container = el.stockCategories;
  container.innerHTML = '';

  const searchQuery = el.searchStock.value.toLowerCase().trim();

  currentCategories.forEach(cat => {
    // カテゴリに属する食材のフィルタリング
    let items = currentFoodItems.filter(item => item.category_id === cat.id);
    
    if (searchQuery) {
      items = items.filter(item => item.name.toLowerCase().includes(searchQuery) || (item.memo && item.memo.toLowerCase().includes(searchQuery)));
    }

    const section = document.createElement('div');
    section.className = 'stock-category';
    section.id = `stock-sec-${cat.id}`;
    section.dataset.categoryId = cat.id;

    // ヘッダー作成
    section.innerHTML = `
      <div class="category-title-header">
        <h3 class="category-title">${cat.icon} ${cat.name}</h3>
        <span class="category-title-count">${items.length}品</span>
      </div>
    `;

    const grid = document.createElement('div');
    grid.className = 'food-grid';
    grid.dataset.categoryId = cat.id;

    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-message" style="grid-column: span 2; padding: 16px;">食材がありません</div>`;
    } else {
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'food-card';
        card.draggable = true;
        card.dataset.id = item.id;

        const emoji = getFoodEmoji(item.name);

        // 賞味期限表示の判定
        let expiryHtml = '';
        let expiryClass = '';
        if (item.expiration_date) {
          const today = new Date();
          today.setHours(0,0,0,0);
          const expDate = new Date(item.expiration_date);
          expDate.setHours(0,0,0,0);
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            expiryHtml = `⚠️ 期限切れ`;
            expiryClass = 'expired';
          } else if (diffDays === 0) {
            expiryHtml = `⏰ 今日まで`;
            expiryClass = 'expired';
          } else if (diffDays <= 3) {
            expiryHtml = `⏰ あと ${diffDays} 日`;
            expiryClass = 'warning';
          } else {
            expiryHtml = `📅 ${item.expiration_date.replace(/^\d{4}-/, '')}`;
          }
        }

        card.innerHTML = `
          <div class="food-card-top">
            <span class="food-card-title">${emoji} ${item.name}</span>
            <span class="food-card-qty">${item.quantity}<span style="font-size:0.7rem; font-weight:normal; margin-left:1px;">${item.unit}</span></span>
          </div>
          <div class="food-card-bottom">
            <span class="food-card-expiry ${expiryClass}">${expiryHtml}</span>
            <div class="food-card-actions">
              <button class="food-action-btn edit-btn" title="編集"><i class="fa-solid fa-pen"></i></button>
              <button class="food-action-btn delete-btn" title="削除"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        `;

        // 編集・削除イベント
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          openFoodModal(item);
        });
        card.querySelector('.delete-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`「${item.name}」を削除しますか？`)) {
            await db.deleteFoodItem(item.id);
            showToast('食材を削除しました', 'info');
            loadAppData(true);
          }
        });
        card.addEventListener('click', () => openFoodModal(item));

        // HTML5 ドラッグ&ドロップイベント (PC向け)
        card.addEventListener('dragstart', (e) => {
          dragSourceId = item.id;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          document.querySelectorAll('.stock-category').forEach(sec => sec.classList.remove('drag-over'));
        });

        // タッチ操作によるスマホドラッグ対応
        card.addEventListener('touchstart', (touchEvent) => {
          swipeStartX = touchEvent.touches[0].clientX;
        }, { passive: true });

        grid.appendChild(card);
      });
    }

    section.appendChild(grid);
    container.appendChild(section);
  });

  // カテゴリ側ドラッグオーバーイベントの設定
  document.querySelectorAll('.stock-category').forEach(sec => {
    sec.addEventListener('dragover', (e) => {
      e.preventDefault();
      sec.classList.add('drag-over');
    });

    sec.addEventListener('dragleave', () => {
      sec.classList.remove('drag-over');
    });

    sec.addEventListener('drop', async (e) => {
      e.preventDefault();
      sec.classList.remove('drag-over');
      
      if (dragSourceId) {
        const item = currentFoodItems.find(i => i.id === dragSourceId);
        const targetCatId = sec.dataset.categoryId;
        
        if (item && item.category_id !== targetCatId) {
          item.category_id = targetCatId;
          await db.saveFoodItem(item);
          showToast('保管場所を変更しました！', 'success');
          loadAppData(true);
        }
      }
      dragSourceId = null;
    });
  });
}

// 3. 賞味期限管理画面の描画
function renderExpiryList() {
  const container = el.expiryList;
  container.innerHTML = '';

  const activeFilterChip = el.expiryFilters.querySelector('.filter-chip.active');
  const filterType = activeFilterChip ? activeFilterChip.dataset.filter : 'all';

  const today = new Date();
  today.setHours(0,0,0,0);

  // 食材を期限付きのもので抽出
  let items = currentFoodItems
    .filter(item => item.expiration_date)
    .map(item => {
      const expDate = new Date(item.expiration_date);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      return { ...item, diffDays };
    });

  // 期限が近い順にソート (すでに切れているのは最上部)
  items.sort((a, b) => a.diffDays - b.diffDays);

  // フィルター処理
  if (filterType === 'danger') {
    items = items.filter(item => item.diffDays <= 0);
  } else if (filterType === 'warning') {
    items = items.filter(item => item.diffDays > 0 && item.diffDays <= 3);
  } else if (filterType === 'soon') {
    items = items.filter(item => item.diffDays > 3 && item.diffDays <= 7);
  }

  if (items.length === 0) {
    container.innerHTML = `<p class="empty-message">表示する食材はありません</p>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'expiry-item';

    let dayText = '';
    let dayClass = 'safe';
    if (item.diffDays < 0) {
      dayText = `期限切れ (過 ${Math.abs(item.diffDays)} 日)`;
      dayClass = 'danger';
    } else if (item.diffDays === 0) {
      dayText = `今日まで！`;
      dayClass = 'danger';
    } else if (item.diffDays <= 3) {
      dayText = `あと ${item.diffDays} 日`;
      dayClass = 'warning';
    } else if (item.diffDays <= 7) {
      dayText = `あと ${item.diffDays} 日`;
      dayClass = 'soon';
    } else {
      dayText = `あと ${item.diffDays} 日`;
      dayClass = 'safe';
    }

    const emoji = getFoodEmoji(item.name);
    const category = currentCategories.find(c => c.id === item.category_id);
    const catName = category ? category.name : 'ストック';

    row.innerHTML = `
      <div class="expiry-item-left">
        <span class="expiry-item-emoji">${emoji}</span>
        <div class="expiry-item-info">
          <span class="expiry-item-name">${item.name}</span>
          <span class="expiry-item-meta">${item.quantity} ${item.unit} • ${catName}</span>
        </div>
      </div>
      <div class="expiry-item-right">
        <div class="expiry-status-box">
          <span class="expiry-days-text ${dayClass}">${dayText}</span>
          <span class="expiry-date-sub">${item.expiration_date}</span>
        </div>
        <div class="expiry-quick-actions">
          <button class="expiry-circle-btn consume" title="消費する"><i class="fa-solid fa-check"></i></button>
          <button class="expiry-circle-btn trash" title="廃棄する"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;

    // 消費ボタン (数量を1減らす。1個なら削除)
    row.querySelector('.consume').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (item.quantity > 1) {
        item.quantity = parseFloat((item.quantity - 1).toFixed(2));
        await db.saveFoodItem(item);
        showToast('1つ消費しました 🍳', 'success');
      } else {
        await db.deleteFoodItem(item.id);
        showToast('すべて消費完了！ごちそうさまでした 😋', 'success');
      }
      loadAppData(true);
    });

    // 廃棄ボタン (直接削除)
    row.querySelector('.trash').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`「${item.name}」を廃棄（ゴミ箱に移動）しますか？`)) {
        await db.deleteFoodItem(item.id);
        showToast('食材を廃棄処分にしました 🗑️', 'info');
        loadAppData(true);
      }
    });

    row.addEventListener('click', () => openFoodModal(item));
    container.appendChild(row);
  });
}

// 4. 設定画面の描画
async function renderSettings() {
  const user = await db.getCurrentUser();
  
  if (db.isCloudMode) {
    el.dbStatusBadge.className = 'badge badge-success';
    el.dbStatusBadge.textContent = 'クラウド同期中';
    el.settingsLogoutSection.style.display = 'block';
  } else {
    el.dbStatusBadge.className = 'badge badge-warning';
    el.dbStatusBadge.textContent = 'ローカルデモモード';
    el.settingsLogoutSection.style.display = 'none';
  }

  if (user) {
    el.settingsDisplayName.textContent = user.user_metadata?.display_name || user.email.split('@')[0];
  } else {
    el.settingsDisplayName.textContent = 'ゲストユーザー';
  }

  // 世帯共有情報の描画
  try {
    const household = await db.getHousehold();
    if (household) {
      el.settingsHouseholdCode.textContent = household.invite_code || '未発行';
    } else {
      el.settingsHouseholdCode.textContent = '未接続';
    }

    const members = await db.getHouseholdMembers();
    el.householdMembersList.innerHTML = members.map(m => `
      <li>
        <i class="fa-solid fa-circle-user"></i>
        <span>${m.display_name}</span>
        <span class="badge ${m.role === 'owner' ? 'badge-success' : 'badge-warning'}" style="margin-left:auto; font-size:0.6rem;">
          ${m.role === 'owner' ? '管理人' : '共有メンバー'}
        </span>
      </li>
    `).join('');
  } catch (err) {
    el.settingsHouseholdCode.textContent = 'エラー';
    el.householdMembersList.innerHTML = `<li><i class="fa-solid fa-triangle-exclamation"></i> メンバーを取得できませんでした</li>`;
  }

  // Geminiステータスの表示
  const geminiBadge = document.getElementById('gemini-status-badge');
  if (geminiBadge) {
    if (gemini.isConfigured()) {
      geminiBadge.className = 'badge badge-success';
      geminiBadge.textContent = '設定済み';
    } else {
      geminiBadge.className = 'badge badge-warning';
      geminiBadge.textContent = '未設定';
    }
  }
}

// -------------------------------------------------------------
// D. モーダル制御
// -------------------------------------------------------------
function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

// 食材編集・追加モーダルオープン
function openFoodModal(item = null) {
  if (item) {
    el.foodModalTitle.textContent = '食材の編集';
    el.foodId.value = item.id;
    el.foodName.value = item.name;
    el.foodCategory.value = item.category_id;
    el.foodQuantity.value = item.quantity;
    el.foodUnit.value = item.unit;
    el.foodExpiration.value = item.expiration_date || '';
    el.foodMemo.value = item.memo || '';
  } else {
    el.foodModalTitle.textContent = '食材の追加';
    el.foodId.value = '';
    el.foodName.value = '';
    el.foodCategory.selectedIndex = 0;
    el.foodQuantity.value = 1;
    el.foodUnit.selectedIndex = 0;
    el.foodExpiration.value = '';
    el.foodMemo.value = '';
  }
  openModal(el.modalFood);
}

// -------------------------------------------------------------
// E. イベントリスナー定義
// -------------------------------------------------------------
function setupEventListeners() {
  // 1. タブナビゲーション
  el.appNav.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem) {
      navigateTo(navItem.dataset.page);
    }
  });

  // 2. 同期ボタン
  el.btnSync.addEventListener('click', () => {
    loadAppData();
    showToast('最新データを同期しました！', 'success');
  });

  // 3. ユーザーボタン (プロフか認証を表示)
  el.btnUser.addEventListener('click', async () => {
    const user = await db.getCurrentUser();
    if (user && db.isCloudMode) {
      openModal(el.modalProfile);
      el.profileName.value = user.user_metadata?.display_name || '';
    } else if (!db.isCloudMode) {
      openModal(el.modalSupabase);
    } else {
      openModal(el.modalAuth);
    }
  });

  // 3b. 認証モーダル
  let isLoginMode = true;
  el.authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    el.authTitle.textContent = isLoginMode ? 'サインイン' : '新規登録';
    el.authSubmitBtn.textContent = isLoginMode ? 'サインイン' : 'アカウント作成';
    el.authToggleLink.textContent = isLoginMode ? '新規登録はこちら' : '既にアカウントをお持ちの方はこちら';
    document.querySelector('.signup-only').style.display = isLoginMode ? 'none' : 'block';
  });

  el.formAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const displayName = document.getElementById('auth-display-name').value.trim();
    
    if (isLoginMode) {
      const { error } = await db.signIn(email, password);
      if (error) {
        showToast('ログインに失敗しました: ' + error.message, 'error');
      } else {
        showToast('ログインしました！', 'success');
        closeModal(el.modalAuth);
        loadAppData();
      }
    } else {
      const { error } = await db.signUp(email, password, displayName);
      if (error) {
        showToast('登録に失敗しました: ' + error.message, 'error');
      } else {
        showToast('アカウントを作成しました！', 'success');
        closeModal(el.modalAuth);
        loadAppData();
      }
    }
  });

  el.btnCloseAuth.addEventListener('click', () => closeModal(el.modalAuth));

  // 4. クイック追加FAB
  el.fabAddFood.addEventListener('click', async () => {
    if (db.isCloudMode) {
      const user = await db.getCurrentUser();
      if (!user) {
        showToast('食材を登録するには、右上のアイコンからサインインしてください', 'warning');
        openModal(el.modalAuth);
        return;
      }
    }
    openFoodModal();
  });

  // 食材保存
  el.formFood.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = {
      name: el.foodName.value.trim(),
      category_id: el.foodCategory.value,
      quantity: parseFloat(el.foodQuantity.value),
      unit: el.foodUnit.value,
      expiration_date: el.foodExpiration.value || null,
      memo: el.foodMemo.value.trim()
    };

    if (el.foodId.value) {
      item.id = el.foodId.value;
    }

    const { error } = await db.saveFoodItem(item);
    
    if (error) {
      showToast('食材の保存に失敗しました: ' + error, 'error');
    } else {
      showToast(item.id ? '変更を保存しました！' : '新しい食材を登録しました！', 'success');
      closeModal(el.modalFood);
      loadAppData(true);
    }
  });

  el.btnCancelFood.addEventListener('click', () => closeModal(el.modalFood));
  el.btnCloseFood.addEventListener('click', () => closeModal(el.modalFood));

  // 5. 検索入力
  el.searchStock.addEventListener('input', () => {
    renderStockGrid();
  });

  // 6. 期限フィルター
  el.expiryFilters.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (chip) {
      el.expiryFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderExpiryList();
    }
  });

  // 7. Supabase 設定モーダル
  el.btnSetupSupabase.addEventListener('click', () => {
    el.sbUrl.value = localStorage.getItem('pantre_supabase_url') || '';
    el.sbKey.value = localStorage.getItem('pantre_supabase_key') || '';
    openModal(el.modalSupabase);
  });

  el.formSupabase.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = el.sbUrl.value.trim();
    const key = el.sbKey.value.trim();

    const isConnected = await db.setupSupabase(url, key);
    
    if (isConnected) {
      showToast('Supabaseクラウドに正常に接続しました！ 🎉', 'success');
      closeModal(el.modalSupabase);
      loadAppData();
    } else {
      showToast('接続に失敗しました。URLまたはキーを確認してください。', 'error');
    }
  });

  el.btnDisconnectSupabase.addEventListener('click', async () => {
    if (confirm('接続を解除してローカルデモモードに戻しますか？データはクラウドから読み込まれなくなります。')) {
      await db.setupSupabase(null, null);
      showToast('ローカルデモモードに切り替えました。', 'info');
      closeModal(el.modalSupabase);
      loadAppData();
    }
  });
  el.btnCloseSupabase.addEventListener('click', () => closeModal(el.modalSupabase));

  // 8. 家族グループ参加
  el.btnJoinHousehold.addEventListener('click', () => {
    if (!db.isCloudMode) {
      showToast('家族共有を利用するには、先にSupabase接続設定を行ってください。', 'info');
      return;
    }
    el.joinCode.value = '';
    openModal(el.modalJoin);
  });

  el.formJoinHousehold.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = el.joinCode.value.trim();
    
    const { data, error } = await db.joinHousehold(code);

    if (error) {
      showToast(error, 'error');
    } else {
      showToast(`「${data.name}」グループに参加しました！ 🏠`, 'success');
      closeModal(el.modalJoin);
      loadAppData();
    }
  });

  el.btnCancelJoin.addEventListener('click', () => closeModal(el.modalJoin));
  el.btnCloseJoin.addEventListener('click', () => closeModal(el.modalJoin));

  // 9. コピーボタン
  el.btnCopyCode.addEventListener('click', () => {
    const code = el.settingsHouseholdCode.textContent;
    if (code && code !== '------' && code !== '未接続') {
      navigator.clipboard.writeText(code)
        .then(() => showToast('招待コードをコピーしました！家族に送ってください 📲', 'success'))
        .catch(() => showToast('コピーに失敗しました', 'error'));
    }
  });

  // 10. プロフィール編集
  el.btnEditProfile.addEventListener('click', async () => {
    const user = await db.getCurrentUser();
    if (user) {
      el.profileName.value = user.user_metadata?.display_name || '';
      openModal(el.modalProfile);
    }
  });

  el.formProfile.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = el.profileName.value.trim();
    
    if (db.isCloudMode) {
      // Supabaseのユーザーメタデータ更新
      const { error } = await db.supabase.auth.updateUser({
        data: { display_name: newName }
      });
      if (error) {
        showToast('プロフィールの更新に失敗しました: ' + error.message, 'error');
      } else {
        showToast('プロフィールを変更しました！', 'success');
        closeModal(el.modalProfile);
        loadAppData(true);
      }
    } else {
      // ローカルアップデート
      const localUser = JSON.parse(localStorage.getItem('pantre_local_user') || '{}');
      localUser.user_metadata = { ...localUser.user_metadata, display_name: newName };
      localStorage.setItem('pantre_local_user', JSON.stringify(localUser));
      showToast('プロフィールを変更しました！', 'success');
      closeModal(el.modalProfile);
      loadAppData(true);
    }
  });

  el.btnCancelProfile.addEventListener('click', () => closeModal(el.modalProfile));
  el.btnCloseProfile.addEventListener('click', () => closeModal(el.modalProfile));

  // 11. ログアウト
  el.btnLogout.addEventListener('click', async () => {
    if (confirm('ログアウトしますか？')) {
      const { error } = await db.signOut();
      if (error) {
        showToast('ログアウトに失敗しました: ' + error.message, 'error');
      } else {
        showToast('ログアウトしました。', 'info');
        loadAppData();
      }
    }
  });

  // モーダル外部タップで閉じる
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // 12. AI API設定モーダルの制御
  const btnSetupGemini = document.getElementById('btn-setup-gemini');
  const modalGemini = document.getElementById('modal-gemini');
  const formGemini = document.getElementById('form-gemini');
  const geminiKeyInput = document.getElementById('gemini-key');
  const btnDisconnectGemini = document.getElementById('btn-disconnect-gemini');
  const btnCloseGemini = document.getElementById('btn-close-gemini');

  if (btnSetupGemini) {
    btnSetupGemini.addEventListener('click', () => {
      geminiKeyInput.value = gemini.getApiKey();
      openModal(modalGemini);
    });
  }

  if (formGemini) {
    formGemini.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = geminiKeyInput.value.trim();
      if (key) {
        gemini.setApiKey(key);
        showToast('Gemini APIキーを設定しました！ 🤖', 'success');
        closeModal(modalGemini);
        renderSettings();
      }
    });
  }

  if (btnDisconnectGemini) {
    btnDisconnectGemini.addEventListener('click', () => {
      if (confirm('Gemini APIキーの設定を削除しますか？')) {
        gemini.setApiKey('');
        showToast('APIキーを削除しました。', 'info');
        closeModal(modalGemini);
        renderSettings();
      }
    });
  }

  if (btnCloseGemini) {
    btnCloseGemini.addEventListener('click', () => closeModal(modalGemini));
  }

  // 未実装設定のヘルパー
  el.btnManageCategories.addEventListener('click', () => {
    showToast('今後のアップデートで、カスタムカテゴリの並び替え・追加に対応予定です！ 🚧', 'info');
  });

  el.btnManageUnits.addEventListener('click', () => {
    showToast('今後のアップデートで、カスタム単位の登録に対応予定です！ 🚧', 'info');
  });
}

// -------------------------------------------------------------
// F. アプリ起動処理
// -------------------------------------------------------------
async function initApp() {
  setupEventListeners();
  
  // 新規ページのコントローラー初期化
  chatController.init();
  calendarController.init();
  reportController.init();
  
  // 初期データ読み込み
  await loadAppData();
  
  // Realtime更新の監視（Supabase時のみ）
  db.subscribe((type, data) => {
    if (type === 'sync') {
      loadAppData(true); // 変更通知があればバックグラウンドでリロード
    } else if (type === 'auth') {
      loadAppData(true);
    }
  });
}

// ドキュメント読み込み完了時に起動
document.addEventListener('DOMContentLoaded', initApp);
