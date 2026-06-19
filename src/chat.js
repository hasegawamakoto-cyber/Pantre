/* -------------------------------------------------------------
 * PanTré (パントレ) - chat.js
 * AIチャットUI コントローラー
 * ------------------------------------------------------------- */

class ChatController {
  constructor() {
    this.messagesContainer = null;
    this.inputEl = null;
    this.sendBtn = null;
    this.micBtn = null;
    this.interimEl = null;
    this.isProcessing = false;
  }

  // --- 初期化 ---
  init() {
    if (this.isInitialized) return;

    this.messagesContainer = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.micBtn = document.getElementById('chat-mic-btn');
    this.interimEl = document.getElementById('speech-interim');

    if (!this.messagesContainer) return;

    this.isInitialized = true;
    this.setupEventListeners();
    this.setupSpeech();
    this.loadHistory();
  }

  async loadHistory() {
    try {
      const messages = await db.getChatMessages(30);
      if (messages && messages.length > 0) {
        const welcome = document.getElementById('chat-welcome');
        if (welcome) welcome.style.display = 'none';
        
        // メッセージコンテナをクリアして描画
        const children = Array.from(this.messagesContainer.children);
        children.forEach(child => {
          if (child.id !== 'chat-welcome') {
            child.remove();
          }
        });
        
        messages.forEach(msg => {
          this.addBubble(msg.content, msg.role, false);
        });

        // Geminiのチャット履歴コンテキストを再構築
        gemini.clearHistory();
        messages.forEach(msg => {
          gemini.chatHistory.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        });
        
        this.scrollToBottom();
      }
    } catch (err) {
      console.error('チャット履歴のロード失敗:', err);
    }
  }

  setupEventListeners() {
    // 送信ボタン
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Enter で送信 (Shift+Enter は改行)
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // テキストエリア自動リサイズ
    this.inputEl.addEventListener('input', () => {
      this.inputEl.style.height = 'auto';
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
      this.sendBtn.disabled = !this.inputEl.value.trim();
    });

    // クイックアクションチップ
    document.querySelectorAll('.quick-action-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.text;
        if (text) {
          this.inputEl.value = text;
          this.sendMessage();
        }
      });
    });

    // チャット履歴クリアボタン
    const clearBtn = document.getElementById('chat-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('チャット履歴をクリアしますか？')) {
          this.clearChat();
        }
      });
    }
  }

  setupSpeech() {
    if (!speech.isAvailable()) {
      this.micBtn.style.display = 'none';
      return;
    }

    this.micBtn.addEventListener('click', () => {
      speech.toggle();
    });

    speech.onStart = () => {
      this.micBtn.classList.add('listening');
      this.micBtn.title = '音声認識中... (タップで停止)';
    };

    speech.onEnd = () => {
      this.micBtn.classList.remove('listening');
      this.micBtn.title = '音声入力';
      if (this.interimEl) this.interimEl.textContent = '';
    };

    speech.onInterim = (text) => {
      if (this.interimEl) {
        this.interimEl.textContent = `🎤 ${text}`;
      }
    };

    speech.onResult = (text) => {
      this.inputEl.value += text;
      this.inputEl.style.height = 'auto';
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
      this.sendBtn.disabled = false;
      if (this.interimEl) this.interimEl.textContent = '';
    };

    speech.onError = (errorMsg) => {
      showToast(errorMsg, 'error');
    };
  }

  // --- メッセージ送信 ---
  async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text || this.isProcessing) return;

    // ウェルカムメッセージを非表示にする
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.style.display = 'none';

    // ユーザーメッセージを表示
    this.addBubble(text, 'user');
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this.sendBtn.disabled = true;

    // タイピングインジケーター表示
    this.showTyping();
    this.isProcessing = true;

    try {
      // コンテキストを構築
      const context = {
        foodItems: currentFoodItems,
        categories: currentCategories,
        mealPlans: await db.getMealPlans(),
        wishRecipes: await db.getWishRecipes()
      };

      // Gemini に送信
      const response = await gemini.sendMessage(text, context);

      // タイピングインジケーター除去
      this.hideTyping();

      // AI メッセージを表示
      this.addBubble(response.message, 'assistant');

      // アクションカードの表示
      if (response.actions && response.actions.length > 0) {
        for (const action of response.actions) {
          this.renderActionCard(action);
        }
      }

    } catch (error) {
      this.hideTyping();
      this.addBubble(`エラーが発生しました: ${error.message}`, 'assistant');
    } finally {
      this.isProcessing = false;
    }
  }

  // --- バブル追加 ---
  addBubble(text, role, save = true) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    if (role === 'assistant') {
      bubble.innerHTML = `<span class="ai-label">🍳 PanTré AI</span><div class="bubble-content">${this.renderMarkdown(text)}</div>`;
    } else {
      bubble.textContent = text;
    }

    this.messagesContainer.appendChild(bubble);
    this.scrollToBottom();

    if (save) {
      db.saveChatMessage({ role, content: text });
    }
  }

  // --- 簡易マークダウンレンダリング ---
  renderMarkdown(text) {
    if (!text) return '';

    // HTMLエスケープ
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // マークダウン変換
    // 太字: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // イタリック: *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // インラインコード: `code`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // 見出し: ### heading
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    // 水平線: --- or ***
    html = html.replace(/^(\*\*\*|---)$/gm, '<hr>');
    // リスト: - item  or ・item
    html = html.replace(/^[・\-]\s*(.+)$/gm, '<li>$1</li>');
    // 連続するliをulで包む
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
    // 段落: 空行で区切る
    html = html.replace(/\n\n/g, '</p><p>');
    // 改行
    html = html.replace(/\n/g, '<br>');

    // pで包む
    if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<hr')) {
      html = `<p>${html}</p>`;
    }

    return html;
  }

  // --- タイピングインジケーター ---
  showTyping() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    this.messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  }

  hideTyping() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  // --- アクションカードの描画 ---
  renderActionCard(action) {
    const card = document.createElement('div');
    card.className = 'action-card';

    switch (action.type) {
      case 'register_food':
        card.innerHTML = this.buildFoodRegisterCard(action);
        this.attachFoodRegisterHandlers(card, action);
        break;

      case 'consume_food':
        card.innerHTML = this.buildFoodConsumeCard(action);
        this.attachFoodConsumeHandlers(card, action);
        break;

      case 'register_meal_plan':
        card.innerHTML = this.buildMealPlanCard(action);
        this.attachMealPlanHandlers(card, action);
        break;

      case 'suggest_recipe':
        card.innerHTML = this.buildRecipeSuggestCard(action);
        this.attachRecipeSuggestHandlers(card, action);
        break;

      case 'add_wish_recipe':
        card.innerHTML = this.buildWishRecipeCard(action);
        this.attachWishRecipeHandlers(card, action);
        break;

      default:
        return; // 未知のアクションは無視
    }

    this.messagesContainer.appendChild(card);
    this.scrollToBottom();
  }

  // --- 食材登録カード ---
  buildFoodRegisterCard(action) {
    const items = action.items || [];
    const itemsHtml = items.map(item => {
      const emoji = getFoodEmoji(item.name);
      return `
        <div class="food-entry">
          <span class="food-emoji">${emoji}</span>
          <div class="food-detail">
            <span class="food-name">${item.name}</span>
            <span class="food-meta">${item.quantity}${item.unit} • ${item.category_name} • 期限: ${item.expiration_date || '未設定'}${item.memo ? ' • ' + item.memo : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="action-card-header">
        <i class="fa-solid fa-box-archive"></i>
        食材の登録 (${items.length}件)
      </div>
      <div class="action-card-body">${itemsHtml}</div>
      <div class="action-card-actions">
        <button class="btn btn-outline btn-sm action-dismiss">スキップ</button>
        <button class="btn btn-primary btn-sm action-confirm">
          <i class="fa-solid fa-check"></i> 登録する
        </button>
      </div>
    `;
  }

  attachFoodRegisterHandlers(card, action) {
    card.querySelector('.action-confirm').addEventListener('click', async () => {
      const items = action.items || [];
      let successCount = 0;

      for (const item of items) {
        // カテゴリIDの解決
        const category = currentCategories.find(c =>
          c.name === item.category_name || c.name.includes(item.category_name)
        );
        const categoryId = category ? category.id : currentCategories[0]?.id;

        const foodData = {
          name: item.name,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit || '個',
          category_id: categoryId,
          expiration_date: item.expiration_date || null,
          memo: item.memo || ''
        };

        const { error } = await db.saveFoodItem(foodData);
        if (!error) successCount++;
      }

      card.classList.add('completed');
      showToast(`${successCount}件の食材を登録しました！ 📦`, 'success');
      await loadAppData(true);
    });

    card.querySelector('.action-dismiss').addEventListener('click', () => {
      card.classList.add('completed');
    });
  }

  // --- 食材消費カード ---
  buildFoodConsumeCard(action) {
    const items = action.items || [];
    const itemsHtml = items.map(item => {
      const emoji = getFoodEmoji(item.name);
      const actionLabel = item.action === 'consume_all' ? '全消費' : item.action === 'reduce' ? `${item.reduce_amount || 1}減らす` : '更新';
      return `
        <div class="food-entry">
          <span class="food-emoji">${emoji}</span>
          <div class="food-detail">
            <span class="food-name">${item.name}</span>
            <span class="food-meta">${actionLabel}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="action-card-header">
        <i class="fa-solid fa-utensils"></i>
        食材の消費・更新 (${items.length}件)
      </div>
      <div class="action-card-body">${itemsHtml}</div>
      <div class="action-card-actions">
        <button class="btn btn-outline btn-sm action-dismiss">スキップ</button>
        <button class="btn btn-primary btn-sm action-confirm">
          <i class="fa-solid fa-check"></i> 反映する
        </button>
      </div>
    `;
  }

  attachFoodConsumeHandlers(card, action) {
    card.querySelector('.action-confirm').addEventListener('click', async () => {
      const items = action.items || [];
      let processedCount = 0;

      for (const item of items) {
        // 名前で既存食材を検索（部分一致）
        const existing = currentFoodItems.find(f =>
          f.name.includes(item.name) || item.name.includes(f.name)
        );

        if (!existing) continue;

        if (item.action === 'consume_all') {
          await db.deleteFoodItem(existing.id);
          processedCount++;
        } else if (item.action === 'reduce') {
          const reduceBy = parseFloat(item.reduce_amount) || 1;
          const newQty = existing.quantity - reduceBy;
          if (newQty <= 0) {
            await db.deleteFoodItem(existing.id);
          } else {
            existing.quantity = newQty;
            await db.saveFoodItem(existing);
          }
          processedCount++;
        }
      }

      card.classList.add('completed');
      showToast(`${processedCount}件の食材を更新しました 🍳`, 'success');
      await loadAppData(true);
    });

    card.querySelector('.action-dismiss').addEventListener('click', () => {
      card.classList.add('completed');
    });
  }

  // --- 献立登録カード ---
  buildMealPlanCard(action) {
    const plans = action.plans || [];
    const plansHtml = plans.map(plan => {
      const mealTypes = { breakfast: '🌅 朝食', lunch: '☀️ 昼食', dinner: '🌙 夕食', snack: '🍪 間食' };
      return `
        <div class="food-entry">
          <span class="food-emoji">${plan.is_eating_out ? '🍽️' : '🍳'}</span>
          <div class="food-detail">
            <span class="food-name">${plan.planned_date} ${mealTypes[plan.meal_type] || plan.meal_type}</span>
            <span class="food-meta">${plan.title}${plan.estimated_calories ? ' • ' + plan.estimated_calories + 'kcal' : ''}${plan.estimated_cost ? ' • ¥' + plan.estimated_cost : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="action-card-header">
        <i class="fa-solid fa-calendar-plus"></i>
        献立の登録 (${plans.length}件)
      </div>
      <div class="action-card-body">${plansHtml}</div>
      <div class="action-card-actions">
        <button class="btn btn-outline btn-sm action-dismiss">スキップ</button>
        <button class="btn btn-primary btn-sm action-confirm">
          <i class="fa-solid fa-check"></i> カレンダーに登録
        </button>
      </div>
    `;
  }

  attachMealPlanHandlers(card, action) {
    card.querySelector('.action-confirm').addEventListener('click', async () => {
      const plans = action.plans || [];
      let successCount = 0;

      for (const plan of plans) {
        const planData = {
          planned_date: plan.planned_date,
          meal_type: plan.meal_type || 'dinner',
          title: plan.title,
          description: plan.description || '',
          ingredients: plan.ingredients || [],
          estimated_calories: plan.estimated_calories || null,
          estimated_pfc: plan.estimated_pfc || null,
          estimated_cost: plan.estimated_cost || null,
          is_eating_out: plan.is_eating_out || false,
          status: 'planned'
        };

        const { error } = await db.saveMealPlan(planData);
        if (!error) successCount++;
      }

      card.classList.add('completed');
      showToast(`${successCount}件の献立を登録しました！ 📅`, 'success');
    });

    card.querySelector('.action-dismiss').addEventListener('click', () => {
      card.classList.add('completed');
    });
  }

  // --- レシピ提案カード ---
  buildRecipeSuggestCard(action) {
    const recipes = action.recipes || [];
    const recipesHtml = recipes.map((recipe, i) => `
      <div class="recipe-card" style="margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
        <div class="recipe-card-title" style="font-weight:600; color:var(--text-primary); font-size:0.95rem;">${i + 1}. ${recipe.title}</div>
        <div class="recipe-card-meta" style="font-size:0.75rem; color:var(--text-secondary); margin:4px 0; display:flex; gap:10px;">
          <span>⏱️ ${recipe.cooking_time || '?'}分</span>
          <span>🔥 ${recipe.estimated_calories || '?'}kcal</span>
          <span>💰 ¥${recipe.estimated_cost || '?'}</span>
        </div>
        <div class="recipe-card-reason" style="font-size:0.75rem; color:var(--color-accent); margin:4px 0;">📌 ${recipe.priority_reason || ''}</div>
        <div class="recipe-card-actions" style="display:flex; gap:8px; margin-top:6px;">
          <button class="btn btn-secondary btn-sm btn-recipe-calendar" data-index="${i}" style="font-size:0.7rem; padding:4px 8px;">
            <i class="fa-solid fa-calendar-plus"></i> 予定登録
          </button>
          <button class="btn btn-secondary btn-sm btn-recipe-wish" data-index="${i}" style="font-size:0.7rem; padding:4px 8px;">
            <i class="fa-solid fa-heart"></i> 作りたい
          </button>
        </div>
      </div>
    `).join('');

    return `
      <div class="action-card-header">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        おすすめレシピ (${recipes.length}件)
      </div>
      <div class="action-card-body">${recipesHtml}</div>
      <div class="action-card-actions">
        <button class="btn btn-outline btn-sm action-dismiss">閉じる</button>
      </div>
    `;
  }

  attachRecipeSuggestHandlers(card, action) {
    const recipes = action.recipes || [];

    card.querySelectorAll('.btn-recipe-calendar').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        const recipe = recipes[index];
        if (!recipe) return;

        const todayStr = new Date().toISOString().split('T')[0];
        
        // カレンダー追加モーダルを開く
        navigateTo('calendar');
        calendarController.openAddMealModal(todayStr);
        calendarController.addMealTitleEl.value = recipe.title;
        calendarController.addMealCalEl.value = recipe.estimated_calories || '';
        calendarController.addMealCostEl.value = recipe.estimated_cost || '';
        
        showToast('カレンダーの登録日付を選択してください 📅', 'info');
      });
    });

    card.querySelectorAll('.btn-recipe-wish').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.index);
        const recipe = recipes[index];
        if (!recipe) return;

        const { error } = await db.saveWishRecipe({
          title: recipe.title,
          notes: `調理時間: ${recipe.cooking_time}分, カロリー: ${recipe.estimated_calories}kcal, 目安コスト: ¥${recipe.estimated_cost}`
        });

        if (error) {
          showToast('お気に入りの登録に失敗しました', 'error');
        } else {
          showToast('作りたいものリストに追加しました！ 📝', 'success');
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-check"></i> 追加済み';
        }
      });
    });

    card.querySelector('.action-dismiss').addEventListener('click', () => {
      card.classList.add('completed');
    });
  }

  // --- 作りたいものリストカード ---
  buildWishRecipeCard(action) {
    const recipes = action.recipes || [];
    const recipesHtml = recipes.map(r => `
      <div class="food-entry">
        <span class="food-emoji">📝</span>
        <div class="food-detail">
          <span class="food-name">${r.title}</span>
          <span class="food-meta">${r.notes || ''}</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="action-card-header">
        <i class="fa-solid fa-heart"></i>
        作りたいものリストに追加 (${recipes.length}件)
      </div>
      <div class="action-card-body">${recipesHtml}</div>
      <div class="action-card-actions">
        <button class="btn btn-outline btn-sm action-dismiss">スキップ</button>
        <button class="btn btn-primary btn-sm action-confirm">
          <i class="fa-solid fa-check"></i> リストに追加
        </button>
      </div>
    `;
  }

  attachWishRecipeHandlers(card, action) {
    card.querySelector('.action-confirm').addEventListener('click', async () => {
      const recipes = action.recipes || [];
      let successCount = 0;

      for (const recipe of recipes) {
        const { error } = await db.saveWishRecipe({
          title: recipe.title,
          notes: recipe.notes || ''
        });
        if (!error) successCount++;
      }

      card.classList.add('completed');
      showToast(`${successCount}件を作りたいものリストに追加しました！ 📝`, 'success');
    });

    card.querySelector('.action-dismiss').addEventListener('click', () => {
      card.classList.add('completed');
    });
  }

  // --- ユーティリティ ---
  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 50);
  }

  clearChat() {
    gemini.clearHistory();
    db.clearChatMessages();
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.style.display = 'flex';

    // メッセージとアクションカードを削除
    const children = Array.from(this.messagesContainer.children);
    children.forEach(child => {
      if (child.id !== 'chat-welcome') {
        child.remove();
      }
    });

    showToast('チャット履歴をクリアしました', 'info');
  }
}

const chatController = new ChatController();
