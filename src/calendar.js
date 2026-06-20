/* -------------------------------------------------------------
 * PanTré (パントレ) - calendar.js
 * カレンダーUI コントローラー（月表示・予定・期限食材表示）
 * ------------------------------------------------------------- */

class CalendarController {
  constructor() {
    this.currentDate = new Date();
    this.selectedDate = null;
    this.consumeIngredients = []; // 新規登録時に消費する食材リスト
    this.viewMode = 'month'; // 'month' または 'week'
    
    // DOM要素キャッシュ
    this.monthLabelEl = null;
    this.gridEl = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.todayBtn = null;
    
    // 詳細モーダル要素
    this.modalEl = null;
    this.detailDateEl = null;
    this.detailMealsEl = null;
    this.detailExpiryEl = null;
    this.btnAddMealEl = null;
    this.btnCloseEl = null;
    
    // 新規登録モーダル
    this.modalAddMealEl = null;
    this.formAddMealEl = null;
    this.addMealDateEl = null;
    this.addMealTitleEl = null;
    this.addMealTypeEl = null;
    this.addMealCalEl = null;
    this.addMealCostEl = null;
    this.addMealEatingOutEl = null;
    this.addMealProteinEl = null;
    this.addMealFatEl = null;
    this.addMealCarbEl = null;
    this.btnCancelAddMealEl = null;
    this.btnCloseAddMealEl = null;
    
    // 消費食材選択用の要素
    this.ingredientsListEl = null;
    this.selectFoodEl = null;
    this.inputQtyEl = null;
    this.labelUnitEl = null;
    this.btnAddConsumeFoodEl = null;
    
    // 編集モード管理
    this.editingMealId = null; // null = 新規, 文字列 = 編集対象のID
    this.modalTitleEl = null;
    this.mealIdEl = null;
    this.submitBtnEl = null;
  }

  init() {
    this.monthLabelEl = document.getElementById('calendar-month-label');
    this.gridEl = document.getElementById('calendar-grid');
    this.prevBtn = document.getElementById('calendar-prev-btn');
    this.nextBtn = document.getElementById('calendar-next-btn');
    this.todayBtn = document.getElementById('calendar-today-btn');
    this.btnViewMonth = document.getElementById('btn-view-month');
    this.btnViewWeek = document.getElementById('btn-view-week');
    
    // モーダル
    this.modalEl = document.getElementById('modal-day-detail');
    this.detailDateEl = document.getElementById('day-detail-date');
    this.detailMealsEl = document.getElementById('day-detail-meals');
    this.detailExpiryEl = document.getElementById('day-detail-expiry');
    this.btnAddMealEl = document.getElementById('btn-add-day-meal');
    this.btnCloseEl = document.getElementById('btn-close-day-detail');
    
    // 新規登録モーダル
    this.modalAddMealEl = document.getElementById('modal-add-meal');
    this.formAddMealEl = document.getElementById('form-add-meal');
    this.addMealDateEl = document.getElementById('add-meal-date');
    this.addMealTitleEl = document.getElementById('add-meal-title');
    this.addMealTypeEl = document.getElementById('add-meal-type');
    this.addMealCalEl = document.getElementById('add-meal-calories');
    this.addMealCostEl = document.getElementById('add-meal-cost');
    this.addMealEatingOutEl = document.getElementById('add-meal-eating-out');
    this.addMealProteinEl = document.getElementById('add-meal-protein');
    this.addMealFatEl = document.getElementById('add-meal-fat');
    this.addMealCarbEl = document.getElementById('add-meal-carb');
    this.btnCancelAddMealEl = document.getElementById('btn-cancel-add-meal');
    this.btnCloseAddMealEl = document.getElementById('btn-close-add-meal');
    
    // 消費食材関連
    this.ingredientsListEl = document.getElementById('add-meal-ingredients-list');
    this.selectFoodEl = document.getElementById('select-consume-food');
    this.inputQtyEl = document.getElementById('input-consume-qty');
    this.labelUnitEl = document.getElementById('label-consume-unit');
    this.btnAddConsumeFoodEl = document.getElementById('btn-add-consume-food');
    
    // 消費モーダル要素
    this.modalConsumeEl = document.getElementById('modal-consume-meal');
    this.consumeConfirmListEl = document.getElementById('consume-confirm-list');
    this.selectExtraConsumeEl = document.getElementById('select-extra-consume-food');
    this.inputExtraConsumeQtyEl = document.getElementById('input-extra-consume-qty');
    this.btnAddExtraConsumeEl = document.getElementById('btn-add-extra-consume');
    this.btnSubmitConsumeEl = document.getElementById('btn-submit-consume-meal');
    this.btnCancelConsumeEl = document.getElementById('btn-cancel-consume-meal');
    this.btnCloseConsumeEl = document.getElementById('btn-close-consume-meal');
    this.currentConsumingMeal = null;
    this.onConsumeSuccessCallback = null;
    
    // 編集モード要素
    this.modalTitleEl = document.getElementById('add-meal-modal-title');
    this.mealIdEl = document.getElementById('add-meal-id');
    this.submitBtnEl = document.getElementById('btn-submit-add-meal');

    if (!this.gridEl) return;

    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.prevBtn.addEventListener('click', () => {
      if (this.viewMode === 'month') {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      } else {
        this.currentDate.setDate(this.currentDate.getDate() - 7);
      }
      this.render();
    });

    this.nextBtn.addEventListener('click', () => {
      if (this.viewMode === 'month') {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      } else {
        this.currentDate.setDate(this.currentDate.getDate() + 7);
      }
      this.render();
    });

    this.todayBtn.addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });

    if (this.btnViewMonth) {
      this.btnViewMonth.addEventListener('click', () => {
        this.viewMode = 'month';
        this.btnViewMonth.classList.add('active');
        this.btnViewWeek.classList.remove('active');
        this.render();
      });
    }

    if (this.btnViewWeek) {
      this.btnViewWeek.addEventListener('click', () => {
        this.viewMode = 'week';
        this.btnViewWeek.classList.add('active');
        this.btnViewMonth.classList.remove('active');
        this.render();
      });
    }

    // モーダルクローズ
    this.btnCloseEl.addEventListener('click', () => this.closeDetailModal());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.closeDetailModal();
    });

    // 献立登録ボタン
    this.btnAddMealEl.addEventListener('click', () => {
      if (!this.selectedDate) return;
      this.openAddMealModal(this.selectedDate);
    });

    // 献立登録モーダルクローズ
    this.btnCancelAddMealEl.addEventListener('click', () => this.closeAddMealModal());
    this.btnCloseAddMealEl.addEventListener('click', () => this.closeAddMealModal());
    this.modalAddMealEl.addEventListener('click', (e) => {
      if (e.target === this.modalAddMealEl) this.closeAddMealModal();
    });

    // 食材選択変更で単位を自動更新
    if (this.selectFoodEl) {
      this.selectFoodEl.addEventListener('change', () => {
        const foodId = this.selectFoodEl.value;
        if (!foodId) {
          this.labelUnitEl.textContent = '個';
          this.inputQtyEl.value = '';
          return;
        }
        const food = currentFoodItems.find(f => f.id === foodId);
        if (food) {
          this.labelUnitEl.textContent = food.unit || '個';
          this.inputQtyEl.value = food.quantity; // 初期値として現在の全量をセット
        }
      });
    }

    // 消費食材のリストへの追加ボタン
    if (this.btnAddConsumeFoodEl) {
      this.btnAddConsumeFoodEl.addEventListener('click', () => {
        const foodId = this.selectFoodEl.value;
        const qty = parseFloat(this.inputQtyEl.value);
        if (!foodId) {
          showToast('消費する食材を選択してください', 'warning');
          return;
        }
        if (isNaN(qty) || qty <= 0) {
          showToast('有効な数量を入力してください', 'warning');
          return;
        }

        const food = currentFoodItems.find(f => f.id === foodId);
        if (food) {
          // すでに追加されているか確認
          const exists = this.consumeIngredients.find(item => item.food_id === foodId);
          if (exists) {
            exists.quantity = qty;
          } else {
            this.consumeIngredients.push({
              food_id: food.id,
              name: food.name,
              quantity: qty,
              unit: food.unit
            });
          }
          this.renderAddMealIngredients();
          // リセット
          this.selectFoodEl.value = '';
          this.inputQtyEl.value = '';
          this.labelUnitEl.textContent = '個';
        }
      });
    }

    // 献立保存
    // 消費モーダルのイベントリスナー
    if (this.btnCancelConsumeEl) {
      this.btnCancelConsumeEl.addEventListener('click', () => this.closeConsumeModal());
    }
    if (this.btnCloseConsumeEl) {
      this.btnCloseConsumeEl.addEventListener('click', () => this.closeConsumeModal());
    }
    if (this.btnAddExtraConsumeEl) {
      this.btnAddExtraConsumeEl.addEventListener('click', () => this.addExtraConsumeItem());
    }
    if (this.btnSubmitConsumeEl) {
      this.btnSubmitConsumeEl.addEventListener('click', () => this.submitConsumeMeal());
    }

    this.formAddMealEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const plan = {
        planned_date: this.addMealDateEl.value,
        title: this.addMealTitleEl.value.trim(),
        meal_type: this.addMealTypeEl.value,
        estimated_calories: parseInt(this.addMealCalEl.value) || null,
        estimated_cost: parseInt(this.addMealCostEl.value) || null,
        is_eating_out: this.addMealEatingOutEl.checked,
        estimated_pfc: {
          protein: this.addMealProteinEl ? this.addMealProteinEl.value || null : null,
          fat: this.addMealFatEl ? this.addMealFatEl.value || null : null,
          carb: this.addMealCarbEl ? this.addMealCarbEl.value || null : null
        },
        ingredients: this.consumeIngredients,
        status: 'planned'
      };

      // 編集モードの場合は既存IDを付与
      if (this.editingMealId) {
        plan.id = this.editingMealId;
      }

      const { error } = await db.saveMealPlan(plan);
      if (error) {
        showToast('献立の' + (this.editingMealId ? '更新' : '登録') + 'に失敗しました: ' + error, 'error');
      } else {
        showToast(this.editingMealId ? '献立を更新しました！ ✏️' : '献立をカレンダーに登録しました！ 📅', 'success');
        const savedDate = plan.planned_date;
        this.closeAddMealModal();
        this.render();
        // 詳細モーダルが対象日付なら再表示
        if (this.selectedDate === savedDate) {
          this.openDetailModal(this.selectedDate);
        }
      }
    });
  }

  async render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // 表示ラベル設定
    if (this.viewMode === 'month') {
      this.monthLabelEl.textContent = `${year}年 ${month + 1}月`;
    } else {
      // 週間ビューのラベル（例： 2026年 6月）
      this.monthLabelEl.textContent = `${year}年 ${month + 1}月 (第${Math.ceil(this.currentDate.getDate() / 7)}週)`;
    }
    
    // 表示期間の計算
    let startOfCalendar, endOfCalendar, totalCells, startDay;

    if (this.viewMode === 'month') {
      const firstDayIndex = new Date(year, month, 1).getDay();
      const lastDate = new Date(year, month + 1, 0).getDate();
      startOfCalendar = new Date(year, month, 1 - firstDayIndex);
      endOfCalendar = new Date(year, month, lastDate + (6 - new Date(year, month, lastDate).getDay()));
      startDay = 1 - firstDayIndex;
      totalCells = Math.ceil((lastDate + firstDayIndex) / 7) * 7;
    } else {
      // 週ビュー
      const currentDayOfWeek = this.currentDate.getDay();
      const date = this.currentDate.getDate();
      startOfCalendar = new Date(year, month, date - currentDayOfWeek);
      endOfCalendar = new Date(year, month, date + (6 - currentDayOfWeek));
      startDay = date - currentDayOfWeek;
      totalCells = 7;
    }

    this.gridEl.innerHTML = '';
    
    // 週間ビュー時のスタイル適用
    if (this.viewMode === 'week') {
      this.gridEl.classList.add('week-view');
    } else {
      this.gridEl.classList.remove('week-view');
    }
    
    // 曜日ヘッダー
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    dayNames.forEach(day => {
      const headerCell = document.createElement('div');
      headerCell.className = 'calendar-day-header';
      headerCell.textContent = day;
      this.gridEl.appendChild(headerCell);
    });

    // 期間のデータ取得
    const pad = n => String(n).padStart(2, '0');
    const startStr = `${startOfCalendar.getFullYear()}-${pad(startOfCalendar.getMonth()+1)}-${pad(startOfCalendar.getDate())}`;
    const endStr = `${endOfCalendar.getFullYear()}-${pad(endOfCalendar.getMonth()+1)}-${pad(endOfCalendar.getDate())}`;

    const mealPlans = await db.getMealPlans(startStr, endStr);
    const foodItems = currentFoodItems; // すでに読み込まれている食材リスト
    
    // グリッドセルの生成
    const today = new Date();
    today.setHours(0,0,0,0);

    let dayCount = startDay;

    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(year, month, dayCount);
      const dateStr = `${cellDate.getFullYear()}-${pad(cellDate.getMonth()+1)}-${pad(cellDate.getDate())}`;
      const isToday = cellDate.getTime() === today.getTime();
      const isOtherMonth = cellDate.getMonth() !== month;
      
      const cell = document.createElement('div');
      cell.className = `calendar-cell ${isToday ? 'today' : ''} ${isOtherMonth ? 'other-month' : ''}`;
      cell.dataset.date = dateStr;
      cell.dataset.dow = cellDate.getDay();
      
      // 日付数値
      const numEl = document.createElement('span');
      numEl.className = 'calendar-day-num';
      numEl.textContent = cellDate.getDate();
      cell.appendChild(numEl);
      
      // バッジ表示エリア
      const badgesEl = document.createElement('div');
      badgesEl.className = 'calendar-badges';
      
      // 1. 賞味期限がくる食材のバッジ
      const expiringFoods = foodItems.filter(item => {
        if (!item.expiration_date) return false;
        return item.expiration_date === dateStr;
      });

      expiringFoods.forEach(food => {
        const badge = document.createElement('span');
        badge.className = 'calendar-badge expiry';
        badge.textContent = `⚠️ ${food.name}`;
        badge.title = `${food.name} の賞味期限`;
        badgesEl.appendChild(badge);
      });

      // 2. 献立予定のバッジ
      const dayMeals = mealPlans.filter(plan => plan.planned_date === dateStr);
      dayMeals.forEach(meal => {
        const badge = document.createElement('span');
        badge.className = `calendar-badge meal ${meal.is_eating_out ? 'eating-out' : ''}`;
        const mealTypeEmojis = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' };
        const emoji = mealTypeEmojis[meal.meal_type] || '🍳';
        badge.textContent = `${emoji} ${meal.title}`;
        badgesEl.appendChild(badge);
      });
      
      cell.appendChild(badgesEl);
      
      // クリックイベント
      cell.addEventListener('click', () => this.openDetailModal(dateStr));
      
      this.gridEl.appendChild(cell);
      dayCount++;
    }
  }

  // --- 詳細モーダル ---
  async openDetailModal(dateStr) {
    this.selectedDate = dateStr;
    // 日付文字列をローカルタイムゾーンで安全にパース（UTC訊問防止）
    const [y, m, d] = dateStr.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    const formattedDate = localDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });

    this.detailDateEl.textContent = formattedDate;
    this.detailMealsEl.innerHTML = '';
    this.detailExpiryEl.innerHTML = '';

    // データ読み込み
    const meals = await db.getMealPlans(dateStr, dateStr);
    const expiringFoods = currentFoodItems.filter(item => item.expiration_date === dateStr);

    // 献立予定の描画
    if (meals.length === 0) {
      this.detailMealsEl.innerHTML = '<div class="day-detail-empty">予定はありません</div>';
    } else {
      meals.forEach(meal => {
        const item = document.createElement('div');
        item.className = 'day-detail-item';
        const mealTypeLabels = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };
        const mealTypeEmojis = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' };
        
        let metaText = mealTypeLabels[meal.meal_type] || meal.meal_type;
        if (meal.estimated_calories) metaText += ` • ${meal.estimated_calories}kcal`;
        if (meal.estimated_cost) metaText += ` • ¥${meal.estimated_cost}`;
        if (meal.is_eating_out) metaText += ' • [外食]';

        let ingText = '';
        if (meal.ingredients && meal.ingredients.length > 0) {
          const ingNames = meal.ingredients.map(ing => {
            if (typeof ing === 'object' && ing !== null) {
              return `${ing.name} (${ing.quantity}${ing.unit || '個'})`;
            }
            return ing;
          });
          ingText = `<div style="font-size:0.75rem; color:var(--color-primary); margin-top:2px;">🛒 消費予定: ${ingNames.join(', ')}</div>`;
        }

        item.innerHTML = `
          <span class="item-icon">${mealTypeEmojis[meal.meal_type] || '🍳'}</span>
          <div class="item-info">
            <div class="item-title">${meal.title}</div>
            <div class="item-meta">${metaText}</div>
            ${ingText}
          </div>
          <div class="item-actions">
            ${meal.status === 'planned' ? `
              <button class="btn btn-secondary btn-sm btn-complete-meal" title="作ったことにする">
                <i class="fa-solid fa-check"></i>
              </button>
            ` : '<span class="badge badge-success">完了</span>'}
            <button class="btn btn-outline btn-sm btn-edit-meal" title="編集">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-delete-meal" title="削除">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;

        // 完了ハンドラー
        const completeBtn = item.querySelector('.btn-complete-meal');
        if (completeBtn) {
          completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 消費モーダルを開く
            this.openConsumeModal(meal, () => {
              this.openDetailModal(dateStr);
              this.render();
            });
          });
        }

        // 編集ハンドラー
        const editBtn = item.querySelector('.btn-edit-meal');
        if (editBtn) {
          editBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.closeDetailModal();
            this.openEditMealModal(meal);
          });
        }

        // 削除ハンドラー
        item.querySelector('.btn-delete-meal').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`献立「${meal.title}」を削除しますか？`)) {
            await db.deleteMealPlan(meal.id);
            showToast('献立を削除しました', 'info');
            this.openDetailModal(dateStr);
            this.render();
          }
        });

        this.detailMealsEl.appendChild(item);
      });
    }

    // 期限食材の描画
    if (expiringFoods.length === 0) {
      this.detailExpiryEl.innerHTML = '<div class="day-detail-empty">期限が切れる食材はありません</div>';
    } else {
      expiringFoods.forEach(food => {
        const item = document.createElement('div');
        item.className = 'day-detail-item';
        const emoji = getFoodEmoji(food.name);
        item.innerHTML = `
          <span class="item-icon">${emoji}</span>
          <div class="item-info">
            <div class="item-title">${food.name}</div>
            <div class="item-meta">数量: ${food.quantity}${food.unit} • 保管: ${currentCategories.find(c => c.id === food.category_id)?.name || '不明'}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-secondary btn-sm btn-consume-food" title="消費する">
              <i class="fa-solid fa-cookie-bite"></i>
            </button>
          </div>
        `;

        item.querySelector('.btn-consume-food').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (food.quantity > 1) {
            food.quantity -= 1;
            await db.saveFoodItem(food);
            showToast('1つ消費しました', 'success');
          } else {
            await db.deleteFoodItem(food.id);
            showToast('完食しました！ごちそうさま 😋', 'success');
          }
          await loadAppData(true);
          this.openDetailModal(dateStr);
          this.render();
        });

        this.detailExpiryEl.appendChild(item);
      });
    }

    this.modalEl.classList.add('active');
  }

  closeDetailModal() {
    this.modalEl.classList.remove('active');
    this.selectedDate = null;
  }

  // --- 献立登録モーダル（新規）---
  openAddMealModal(dateStr) {
    this.editingMealId = null;
    if (this.modalTitleEl) this.modalTitleEl.textContent = '献立の追加';
    if (this.submitBtnEl) this.submitBtnEl.textContent = '登録する';
    if (this.mealIdEl) this.mealIdEl.value = '';
    
    this.addMealDateEl.value = dateStr;
    this.addMealTitleEl.value = '';
    this.addMealTypeEl.value = 'dinner';
    this.addMealCalEl.value = '';
    this.addMealCostEl.value = '';
    this.addMealEatingOutEl.checked = false;
    if (this.addMealProteinEl) this.addMealProteinEl.value = '';
    if (this.addMealFatEl) this.addMealFatEl.value = '';
    if (this.addMealCarbEl) this.addMealCarbEl.value = '';
    
    // 消費食材のクリアと初期化
    this.consumeIngredients = [];
    this.renderAddMealIngredients();
    
    if (this.selectFoodEl) {
      this.selectFoodEl.innerHTML = '<option value="">-- ストックから選択 --</option>';
      currentFoodItems.forEach(food => {
        const option = document.createElement('option');
        option.value = food.id;
        option.textContent = `${food.name} (残: ${food.quantity}${food.unit})`;
        this.selectFoodEl.appendChild(option);
      });
      this.inputQtyEl.value = '';
      this.labelUnitEl.textContent = '個';
    }
    
    this.modalAddMealEl.classList.add('active');
  }

  // --- 献立編集モーダル ---
  openEditMealModal(meal) {
    this.editingMealId = meal.id;
    if (this.modalTitleEl) this.modalTitleEl.textContent = '献立の編集';
    if (this.submitBtnEl) this.submitBtnEl.textContent = '更新する';
    if (this.mealIdEl) this.mealIdEl.value = meal.id || '';
    
    this.addMealDateEl.value = meal.planned_date;
    this.addMealTitleEl.value = meal.title || '';
    this.addMealTypeEl.value = meal.meal_type || 'dinner';
    this.addMealCalEl.value = meal.estimated_calories || '';
    this.addMealCostEl.value = meal.estimated_cost || '';
    this.addMealEatingOutEl.checked = !!meal.is_eating_out;
    
    // PFC値を復元
    const pfc = meal.estimated_pfc || {};
    if (this.addMealProteinEl) this.addMealProteinEl.value = pfc.protein || '';
    if (this.addMealFatEl) this.addMealFatEl.value = pfc.fat || '';
    if (this.addMealCarbEl) this.addMealCarbEl.value = pfc.carb || '';
    
    // 消費食材リストを既存データから復元
    this.consumeIngredients = Array.isArray(meal.ingredients) ? [...meal.ingredients] : [];
    this.renderAddMealIngredients();
    
    if (this.selectFoodEl) {
      this.selectFoodEl.innerHTML = '<option value="">-- ストックから選択 --</option>';
      currentFoodItems.forEach(food => {
        const option = document.createElement('option');
        option.value = food.id;
        option.textContent = `${food.name} (残: ${food.quantity}${food.unit})`;
        this.selectFoodEl.appendChild(option);
      });
      this.inputQtyEl.value = '';
      this.labelUnitEl.textContent = '個';
    }
    
    this.modalAddMealEl.classList.add('active');
  }

  closeAddMealModal() {
    this.modalAddMealEl.classList.remove('active');
  }

  renderAddMealIngredients() {
    this.ingredientsListEl.innerHTML = '';
    this.consumeIngredients.forEach((item, index) => {
      const chip = document.createElement('div');
      chip.className = 'add-meal-ingredient-chip';
      chip.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:6px; font-size:0.85rem;';
      chip.innerHTML = `
        <span>${item.name} (${item.quantity}${item.unit})</span>
        <button type="button" class="btn-delete-ingredient" data-index="${index}" style="background:none; border:none; color:var(--color-danger); cursor:pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      chip.querySelector('.btn-delete-ingredient').addEventListener('click', () => {
        this.consumeIngredients.splice(index, 1);
        this.renderAddMealIngredients();
      });
      this.ingredientsListEl.appendChild(chip);
    });
  }

  // --- 消費確認モーダル ---
  openConsumeModal(meal, onSuccess) {
    this.currentConsumingMeal = meal;
    this.onConsumeSuccessCallback = onSuccess;
    
    // 現在の献立の消費予定リストを展開
    this.consumeConfirmListEl.innerHTML = '';
    const ingredients = meal.ingredients || [];
    
    if (ingredients.length === 0) {
      this.consumeConfirmListEl.innerHTML = '<p class="empty-message" style="font-size:0.8rem; text-align:left; padding-left:10px;">事前に登録された消費予定食材はありません。</p>';
    }

    ingredients.forEach((ing, index) => {
      this.addConsumeInputRow(ing, index);
    });

    // 追加用のセレクトボックス初期化
    this.selectExtraConsumeEl.innerHTML = '<option value="">-- 追加食材を選択 --</option>' +
      currentFoodItems.map(item => `<option value="${item.id}">${item.name} (在庫: ${item.quantity}${item.unit})</option>`).join('');
    this.inputExtraConsumeQtyEl.value = '';

    this.modalConsumeEl.classList.add('active');
  }

  closeConsumeModal() {
    this.modalConsumeEl.classList.remove('active');
    this.currentConsumingMeal = null;
    this.onConsumeSuccessCallback = null;
  }

  addConsumeInputRow(ing, index) {
    let name = '';
    let defaultQty = 1;
    let unit = '';
    let foodId = null;

    if (typeof ing === 'object' && ing !== null) {
      name = ing.name;
      defaultQty = ing.quantity || 1;
      unit = ing.unit || '';
      foodId = ing.food_id;
    } else {
      name = ing;
    }

    // 在庫を検索
    let existing = null;
    if (foodId) {
      existing = currentFoodItems.find(f => f.id === foodId);
    } else {
      existing = currentFoodItems.find(f => f.name.includes(name) || name.includes(f.name));
    }

    const maxQty = existing ? existing.quantity : 999;
    const matchedUnit = existing ? existing.unit : unit;

    const row = document.createElement('div');
    row.className = 'consume-row';
    row.style = 'display:flex; align-items:center; gap:8px; margin-bottom:12px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;';
    
    row.innerHTML = `
      <div style="flex: 1; font-size: 0.9rem;">
        <div style="font-weight:bold;">${name}</div>
        <div style="font-size: 0.75rem; color:var(--text-secondary);">在庫: ${existing ? `${existing.quantity}${existing.unit}` : '不明'}</div>
      </div>
      <div style="display:flex; align-items:center; gap:4px; width: 140px;">
        <input type="number" class="consume-qty-input" value="${defaultQty}" step="any" min="0" max="${maxQty}" style="width:70px; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-input); color:white;">
        <span style="font-size:0.8rem; color:var(--text-secondary);">${matchedUnit}</span>
        <input type="hidden" class="consume-food-id" value="${existing ? existing.id : ''}">
        <input type="hidden" class="consume-food-name" value="${name}">
        <input type="hidden" class="consume-food-unit" value="${matchedUnit}">
      </div>
      <button type="button" class="btn-remove-consume-row" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    `;

    row.querySelector('.btn-remove-consume-row').addEventListener('click', () => {
      row.remove();
      if (this.consumeConfirmListEl.children.length === 0) {
        this.consumeConfirmListEl.innerHTML = '<p class="empty-message" style="font-size:0.8rem; text-align:left; padding-left:10px;">消費する食材はありません。</p>';
      }
    });

    this.consumeConfirmListEl.appendChild(row);
  }

  addExtraConsumeItem() {
    const foodId = this.selectExtraConsumeEl.value;
    const qtyStr = this.inputExtraConsumeQtyEl.value;
    const qty = parseFloat(qtyStr);

    if (!foodId || isNaN(qty) || qty <= 0) {
      showToast('追加する食材と正しい数量を指定してください', 'warning');
      return;
    }

    const food = currentFoodItems.find(f => f.id === foodId);
    if (!food) return;

    // Remove empty message if present
    const emptyMsg = this.consumeConfirmListEl.querySelector('.empty-message');
    if (emptyMsg) emptyMsg.remove();

    this.addConsumeInputRow({
      name: food.name,
      quantity: qty,
      unit: food.unit,
      food_id: food.id
    }, Date.now());

    // Reset input
    this.selectExtraConsumeEl.value = '';
    this.inputExtraConsumeQtyEl.value = '';
  }

  async submitConsumeMeal() {
    if (!this.currentConsumingMeal) return;
    
    this.btnSubmitConsumeEl.disabled = true;
    this.btnSubmitConsumeEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 処理中...';

    try {
      const meal = this.currentConsumingMeal;
      meal.status = 'completed';
      
      // 1. 献立を更新
      await db.saveMealPlan(meal);
      
      // 2. 食事記録 (meal_logs) に登録
      const logData = {
        meal_plan_id: meal.id,
        logged_date: meal.planned_date,
        meal_type: meal.meal_type,
        title: meal.title,
        actual_calories: meal.estimated_calories,
        actual_pfc: meal.estimated_pfc,
        actual_cost: meal.estimated_cost,
        is_eating_out: meal.is_eating_out,
        notes: 'カレンダーから実績登録'
      };
      await db.saveMealLog(logData);

      // 3. 食材消費のアクション
      const rows = this.consumeConfirmListEl.querySelectorAll('.consume-row');
      let consumedNames = [];
      
      for (const row of rows) {
        const foodId = row.querySelector('.consume-food-id').value;
        const consumeQty = parseFloat(row.querySelector('.consume-qty-input').value);
        const name = row.querySelector('.consume-food-name').value;
        const unit = row.querySelector('.consume-food-unit').value;

        if (!foodId || isNaN(consumeQty) || consumeQty <= 0) continue;

        const existing = currentFoodItems.find(f => f.id === foodId);
        if (existing) {
          const newQty = existing.quantity - consumeQty;
          if (newQty > 0) {
            existing.quantity = parseFloat(newQty.toFixed(2));
            await db.saveFoodItem(existing);
          } else {
            await db.deleteFoodItem(existing.id);
            // メモリ上からも削除
            const idx = currentFoodItems.findIndex(f => f.id === existing.id);
            if (idx !== -1) currentFoodItems.splice(idx, 1);
          }
          consumedNames.push(`${name} (${consumeQty}${unit})`);
        }
      }

      if (consumedNames.length > 0) {
        showToast(`食材を消費しました: ${consumedNames.join(', ')} 🍳`, 'success');
      } else {
        showToast('ご飯作りました！実績に記録しました 😋', 'success');
      }

      const cb = this.onConsumeSuccessCallback;
      this.closeConsumeModal();
      if (cb) cb();

    } catch (err) {
      console.error(err);
      showToast('処理に失敗しました', 'error');
    } finally {
      this.btnSubmitConsumeEl.disabled = false;
      this.btnSubmitConsumeEl.textContent = '完了して在庫を減らす';
    }
  }
}

const calendarController = new CalendarController();
