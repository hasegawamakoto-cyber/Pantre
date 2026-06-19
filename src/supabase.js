/* -------------------------------------------------------------
 * PanTré (パントレ) - supabase.js
 * Supabase クライアント & ローカルストレージのハイブリッドデータ層
 * ------------------------------------------------------------- */



class DataService {
  constructor() {
    this.supabase = null;
    this.isCloudMode = false;
    this.session = null;
    this.listeners = []; // リアルタイムデータ更新のリスナー

    this.init();
  }

  // 1. 初期化処理
  init() {
    const sbUrl = localStorage.getItem('pantre_supabase_url');
    const sbKey = localStorage.getItem('pantre_supabase_key');

    // Supabase CDNが読み込まれており、認証情報がある場合
    if (window.supabase && sbUrl && sbKey) {
      try {
        this.supabase = window.supabase.createClient(sbUrl, sbKey);
        this.isCloudMode = true;
        
        // 認証状態の監視
        this.supabase.auth.onAuthStateChange((event, session) => {
          this.session = session;
          this.triggerListeners('auth', { event, session });
        });
        
        console.log('PanTré: Supabase クラウドモードに接続しました 🚀');
      } catch (err) {
        console.error('Supabase 初期化エラー。ローカルモードで起動します:', err);
        this.fallbackToLocal();
      }
    } else {
      this.fallbackToLocal();
    }
  }

  fallbackToLocal() {
    this.supabase = null;
    this.isCloudMode = false;
    this.session = null;
    
    // ローカルデータの初期値セットアップ
    if (!localStorage.getItem('pantre_local_food_items')) {
      localStorage.setItem('pantre_local_food_items', JSON.stringify(getMockFoodItems()));
    }
    if (!localStorage.getItem('pantre_local_categories')) {
      localStorage.setItem('pantre_local_categories', JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem('pantre_local_meal_plans')) {
      localStorage.setItem('pantre_local_meal_plans', JSON.stringify([]));
    }
    if (!localStorage.getItem('pantre_local_meal_logs')) {
      localStorage.setItem('pantre_local_meal_logs', JSON.stringify([]));
    }
    if (!localStorage.getItem('pantre_local_chat_messages')) {
      localStorage.setItem('pantre_local_chat_messages', JSON.stringify([]));
    }
    if (!localStorage.getItem('pantre_local_wish_recipes')) {
      localStorage.setItem('pantre_local_wish_recipes', JSON.stringify([]));
    }
    
    console.log('PanTré: ローカルデモモードで起動しました 📦');
  }

  // 2. イベントリスナー
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  triggerListeners(type, data) {
    this.listeners.forEach(listener => {
      try {
        listener(type, data);
      } catch (err) {
        console.error('リスナー実行エラー:', err);
      }
    });
  }

  // 3. 認証関連 (Supabase Auth / ローカルダミー)
  async signUp(email, password, displayName) {
    if (!this.isCloudMode) {
      // ローカルモードでのダミー登録
      const mockUser = {
        id: 'mock-user-123',
        email,
        user_metadata: { display_name: displayName || 'ゲストユーザー' }
      };
      localStorage.setItem('pantre_local_user', JSON.stringify(mockUser));
      this.triggerListeners('auth', { event: 'SIGNED_IN', session: { user: mockUser } });
      return { data: { user: mockUser }, error: null };
    }

    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });
      
      if (!error && !data.session) {
        return { data: null, error: { message: '確認メールを送信しました。メール内のリンクをクリックして登録を完了するか、Supabaseの「Authentication」設定で「Confirm email」をオフにして再度お試しください。' } };
      }
      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async signIn(email, password) {
    if (!this.isCloudMode) {
      // ローカルモードでのダミーログイン
      const mockUser = {
        id: 'mock-user-123',
        email,
        user_metadata: { display_name: 'ゲストユーザー' }
      };
      localStorage.setItem('pantre_local_user', JSON.stringify(mockUser));
      this.triggerListeners('auth', { event: 'SIGNED_IN', session: { user: mockUser } });
      return { data: { user: mockUser }, error: null };
    }

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async signOut() {
    if (!this.isCloudMode) {
      localStorage.removeItem('pantre_local_user');
      this.triggerListeners('auth', { event: 'SIGNED_OUT', session: null });
      return { error: null };
    }
    
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  async getCurrentUser() {
    if (!this.isCloudMode) {
      const localUserJson = localStorage.getItem('pantre_local_user');
      return localUserJson ? JSON.parse(localUserJson) : null;
    }
    
    if (this.session) return this.session.user;
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  // 4. 世帯（ファミリー共有）関連
  async getHousehold() {
    if (!this.isCloudMode) {
      return { id: 'local-household-999', name: 'マイホーム', invite_code: 'DEMO-1234' };
    }

    const user = await this.getCurrentUser();
    console.log('[PanTré Debug] getHousehold: currentUser =', user?.id, user?.email);
    if (!user) {
      console.error('[PanTré Debug] ユーザーが取得できません (未ログイン?)');
      return null;
    }

    // ユーザーに所属する世帯を取得
    const { data: memberData, error: memberErr } = await this.supabase
      .from('household_members')
      .select('household_id, role, households(name, invite_code)')
      .eq('user_id', user.id)
      .single();

    console.log('[PanTré Debug] household_members query: memberData =', memberData, 'error =', memberErr?.message, memberErr?.code);

    if (memberErr || !memberData) {
      // 世帯に属していなければ新しく作成する
      console.log('[PanTré Debug] 世帯が見つからないため新規作成します');
      const newHousehold = await this.createHousehold('新しい世帯');
      console.log('[PanTré Debug] createHousehold result:', newHousehold);
      return newHousehold;
    }

    return {
      id: memberData.household_id,
      name: memberData.households.name,
      invite_code: memberData.households.invite_code,
      role: memberData.role
    };
  }

  async createHousehold(name) {
    const user = await this.getCurrentUser();
    if (!user) return null;

    // ランダムな招待コードの生成
    const inviteCode = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                       Math.random().toString(36).substring(2, 6).toUpperCase();

    // 1. 世帯を作成
    const { data: household, error: hErr } = await this.supabase
      .from('households')
      .insert({ name, invite_code: inviteCode })
      .select()
      .single();

    if (hErr) return null;

    // 2. メンバーに登録
    await this.supabase
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: user.id,
        role: 'owner'
      });

    return household;
  }

  async joinHousehold(inviteCode) {
    if (!this.isCloudMode) {
      return { error: 'ローカルデモモードでは世帯の結合はできません。Supabaseを設定してください。' };
    }

    const user = await this.getCurrentUser();
    if (!user) return { error: 'ユーザーログインが必要です' };

    // 1. 招待コードに一致する世帯を検索
    const { data: household, error: hErr } = await this.supabase
      .from('households')
      .select('id, name')
      .eq('invite_code', inviteCode.trim())
      .single();

    if (hErr || !household) {
      return { error: '有効な招待コードが見つかりません。コードを確認してください。' };
    }

    // 2. 既存の所属をクリアまたは移行
    await this.supabase
      .from('household_members')
      .delete()
      .eq('user_id', user.id);

    // 3. メンバーとして新規登録
    const { error: joinErr } = await this.supabase
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: user.id,
        role: 'member'
      });

    if (joinErr) return { error: joinErr.message };

    this.triggerListeners('sync', { event: 'HOUSEHOLD_CHANGED' });
    return { data: household, error: null };
  }

  async getHouseholdMembers() {
    if (!this.isCloudMode) {
      const user = await this.getCurrentUser() || { user_metadata: { display_name: 'ゲストユーザー' } };
      return [{ display_name: user.user_metadata?.display_name || 'ゲストユーザー', role: 'owner' }];
    }

    const household = await this.getHousehold();
    if (!household) return [];

    const { data, error } = await this.supabase
      .from('household_members')
      .select('role, user_id')
      .eq('household_id', household.id);

    if (error) return [];

    // メンバー詳細（プロフィール情報）の取得
    const members = [];
    for (const m of data) {
      // Supabaseのユーザープロパティはauthからとる必要があるため、公開プロフィールテーブルやメタデータから結合
      const { data: profile } = await this.supabase
        .rpc('get_user_profile', { user_id_param: m.user_id }); 
      
      members.push({
        display_name: profile?.display_name || '家族のメンバー',
        role: m.role
      });
    }

    return members;
  }

  // 5. カテゴリ関連のCRUD
  async getCategories() {
    if (!this.isCloudMode) {
      const cats = localStorage.getItem('pantre_local_categories');
      return JSON.parse(cats).sort((a,b) => a.sort_order - b.sort_order);
    }

    const household = await this.getHousehold();
    console.log('[PanTré Debug] getCategories: household =', household);
    if (!household) {
      console.error('[PanTré Debug] 世帯が見つかりません。カテゴリは空です。');
      return [];
    }

    // Supabaseからデータを取得
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('household_id', household.id)
      .order('sort_order');

    console.log('[PanTré Debug] categories query result: data =', data, 'error =', error);

    if (error) {
      console.error('[PanTré Debug] カテゴリ取得エラー:', error.message, error.code);
      return [];
    }

    if (!data || data.length === 0) {
      // 初回ならデフォルトカテゴリを作成して保存する
      console.log('[PanTré Debug] カテゴリが空なのでデフォルトカテゴリを作成します');
      const initResult = await this.initDefaultCategories(household.id);
      console.log('[PanTré Debug] initDefaultCategories result:', initResult);
      if (initResult && initResult.error) {
        console.error('[PanTré Debug] デフォルトカテゴリ作成エラー:', initResult.error);
        return [];
      }
      return this.getCategories();
    }

    return data;
  }

  async initDefaultCategories(householdId) {
    const categoriesToInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
      household_id: householdId,
      name: cat.name,
      icon: cat.icon,
      sort_order: index + 1,
      is_default: true
    }));

    console.log('[PanTré Debug] inserting default categories:', categoriesToInsert);
    const result = await this.supabase.from('categories').insert(categoriesToInsert);
    console.log('[PanTré Debug] insert categories result:', result);
    return result;
  }

  // 6. 食材データのCRUD
  async getFoodItems() {
    if (!this.isCloudMode) {
      const items = localStorage.getItem('pantre_local_food_items');
      return JSON.parse(items);
    }

    const household = await this.getHousehold();
    if (!household) return [];

    const { data, error } = await this.supabase
      .from('food_items')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });

    return error ? [] : data;
  }

  async saveFoodItem(item) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_food_items') || '[]');
      let savedItem;

      if (item.id) {
        // 更新
        const index = items.findIndex(i => i.id === item.id);
        if (index !== -1) {
          items[index] = { ...items[index], ...item, updated_at: new Date().toISOString() };
          savedItem = items[index];
        }
      } else {
        // 新規
        savedItem = {
          ...item,
          id: 'local-' + Math.random().toString(36).substring(2, 11),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        items.push(savedItem);
      }

      localStorage.setItem('pantre_local_food_items', JSON.stringify(items));
      this.triggerListeners('sync', { event: item.id ? 'UPDATE' : 'INSERT', item: savedItem });
      return { data: savedItem, error: null };
    }

    const household = await this.getHousehold();
    const user = await this.getCurrentUser();
    if (!household || !user) return { error: 'ユーザーセッションが無効です' };

    const payload = {
      ...item,
      household_id: household.id,
      registered_by: user.id
    };

    let result;
    if (item.id) {
      // クラウド更新
      result = await this.supabase
        .from('food_items')
        .update(payload)
        .eq('id', item.id)
        .select()
        .single();
    } else {
      // クラウド新規登録
      result = await this.supabase
        .from('food_items')
        .insert(payload)
        .select()
        .single();
    }

    if (!result.error) {
      this.triggerListeners('sync', { event: item.id ? 'UPDATE' : 'INSERT', item: result.data });
    }
    return result;
  }

  async deleteFoodItem(id) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_food_items') || '[]');
      const filtered = items.filter(i => i.id !== id);
      localStorage.setItem('pantre_local_food_items', JSON.stringify(filtered));
      this.triggerListeners('sync', { event: 'DELETE', id });
      return { error: null };
    }

    const result = await this.supabase
      .from('food_items')
      .delete()
      .eq('id', id);

    if (!result.error) {
      this.triggerListeners('sync', { event: 'DELETE', id });
    }
    return result;
  }

  // --- 献立予定 (meal_plans) ---
  async getMealPlans(startDate, endDate) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_meal_plans') || '[]');
      if (startDate && endDate) {
        return items.filter(p => p.planned_date >= startDate && p.planned_date <= endDate);
      }
      return items;
    }

    const household = await this.getHousehold();
    if (!household) return [];

    let query = this.supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', household.id);
    
    if (startDate) query = query.gte('planned_date', startDate);
    if (endDate) query = query.lte('planned_date', endDate);

    const { data, error } = await query.order('planned_date', { ascending: true });
    return error ? [] : data;
  }

  async saveMealPlan(plan) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_meal_plans') || '[]');
      let savedItem;

      if (plan.id) {
        const index = items.findIndex(i => i.id === plan.id);
        if (index !== -1) {
          items[index] = { ...items[index], ...plan, updated_at: new Date().toISOString() };
          savedItem = items[index];
        }
      } else {
        savedItem = {
          ...plan,
          id: 'local-' + Math.random().toString(36).substring(2, 11),
          created_at: new Date().toISOString()
        };
        items.push(savedItem);
      }

      localStorage.setItem('pantre_local_meal_plans', JSON.stringify(items));
      this.triggerListeners('sync', { event: plan.id ? 'UPDATE_MEAL' : 'INSERT_MEAL', item: savedItem });
      return { data: savedItem, error: null };
    }

    const household = await this.getHousehold();
    if (!household) return { error: 'ユーザーセッションが無効です' };

    const payload = {
      ...plan,
      household_id: household.id
    };

    let result;
    if (plan.id) {
      result = await this.supabase
        .from('meal_plans')
        .update(payload)
        .eq('id', plan.id)
        .select()
        .single();
    } else {
      result = await this.supabase
        .from('meal_plans')
        .insert(payload)
        .select()
        .single();
    }

    if (!result.error) {
      this.triggerListeners('sync', { event: plan.id ? 'UPDATE_MEAL' : 'INSERT_MEAL', item: result.data });
    }
    return result;
  }

  async deleteMealPlan(id) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_meal_plans') || '[]');
      const filtered = items.filter(i => i.id !== id);
      localStorage.setItem('pantre_local_meal_plans', JSON.stringify(filtered));
      this.triggerListeners('sync', { event: 'DELETE_MEAL', id });
      return { error: null };
    }

    const result = await this.supabase
      .from('meal_plans')
      .delete()
      .eq('id', id);

    if (!result.error) {
      this.triggerListeners('sync', { event: 'DELETE_MEAL', id });
    }
    return result;
  }

  // --- 食事記録 (meal_logs) ---
  async getMealLogs(startDate, endDate) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_meal_logs') || '[]');
      if (startDate && endDate) {
        return items.filter(p => p.logged_date >= startDate && p.logged_date <= endDate);
      }
      return items;
    }

    const household = await this.getHousehold();
    if (!household) return [];

    let query = this.supabase
      .from('meal_logs')
      .select('*')
      .eq('household_id', household.id);
    
    if (startDate) query = query.gte('logged_date', startDate);
    if (endDate) query = query.lte('logged_date', endDate);

    const { data, error } = await query.order('logged_date', { ascending: true });
    return error ? [] : data;
  }

  async saveMealLog(log) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_meal_logs') || '[]');
      let savedItem;

      if (log.id) {
        const index = items.findIndex(i => i.id === log.id);
        if (index !== -1) {
          items[index] = { ...items[index], ...log, updated_at: new Date().toISOString() };
          savedItem = items[index];
        }
      } else {
        savedItem = {
          ...log,
          id: 'local-' + Math.random().toString(36).substring(2, 11),
          created_at: new Date().toISOString()
        };
        items.push(savedItem);
      }

      localStorage.setItem('pantre_local_meal_logs', JSON.stringify(items));
      this.triggerListeners('sync', { event: log.id ? 'UPDATE_LOG' : 'INSERT_LOG', item: savedItem });
      return { data: savedItem, error: null };
    }

    const household = await this.getHousehold();
    if (!household) return { error: 'ユーザーセッションが無効です' };

    const payload = {
      ...log,
      household_id: household.id
    };

    let result;
    if (log.id) {
      result = await this.supabase
        .from('meal_logs')
        .update(payload)
        .eq('id', log.id)
        .select()
        .single();
    } else {
      result = await this.supabase
        .from('meal_logs')
        .insert(payload)
        .select()
        .single();
    }

    if (!result.error) {
      this.triggerListeners('sync', { event: log.id ? 'UPDATE_LOG' : 'INSERT_LOG', item: result.data });
    }
    return result;
  }

  async deleteMealLog(id) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_meal_logs') || '[]');
      const filtered = items.filter(i => i.id !== id);
      localStorage.setItem('pantre_local_meal_logs', JSON.stringify(filtered));
      this.triggerListeners('sync', { event: 'DELETE_LOG', id });
      return { error: null };
    }

    const result = await this.supabase
      .from('meal_logs')
      .delete()
      .eq('id', id);

    if (!result.error) {
      this.triggerListeners('sync', { event: 'DELETE_LOG', id });
    }
    return result;
  }

  // --- チャット履歴 (chat_messages) ---
  async getChatMessages(limit = 50) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_chat_messages') || '[]');
      return items.slice(-limit);
    }

    const household = await this.getHousehold();
    if (!household) return [];

    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true })
      .limit(limit);

    return error ? [] : data;
  }

  async saveChatMessage(msg) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_chat_messages') || '[]');
      const savedItem = {
        ...msg,
        id: 'local-' + Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString()
      };
      items.push(savedItem);
      localStorage.setItem('pantre_local_chat_messages', JSON.stringify(items));
      return { data: savedItem, error: null };
    }

    const household = await this.getHousehold();
    const user = await this.getCurrentUser();
    if (!household) return { error: 'ユーザー世帯が無効です' };

    const payload = {
      ...msg,
      household_id: household.id,
      user_id: user ? user.id : null
    };

    const result = await this.supabase
      .from('chat_messages')
      .insert(payload)
      .select()
      .single();

    return result;
  }

  async clearChatMessages() {
    if (!this.isCloudMode) {
      localStorage.setItem('pantre_local_chat_messages', JSON.stringify([]));
      return { error: null };
    }

    const household = await this.getHousehold();
    if (!household) return { error: 'ユーザー世帯が無効です' };

    const result = await this.supabase
      .from('chat_messages')
      .delete()
      .eq('household_id', household.id);

    return result;
  }

  // --- 作りたいものリスト (wish_recipes) ---
  async getWishRecipes() {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_wish_recipes') || '[]');
      return items;
    }

    const household = await this.getHousehold();
    if (!household) return [];

    const { data, error } = await this.supabase
      .from('wish_recipes')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });

    return error ? [] : data;
  }

  async saveWishRecipe(recipe) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_wish_recipes') || '[]');
      let savedItem;

      if (recipe.id) {
        const index = items.findIndex(i => i.id === recipe.id);
        if (index !== -1) {
          items[index] = { ...items[index], ...recipe };
          savedItem = items[index];
        }
      } else {
        savedItem = {
          ...recipe,
          id: 'local-' + Math.random().toString(36).substring(2, 11),
          is_completed: false,
          created_at: new Date().toISOString()
        };
        items.push(savedItem);
      }

      localStorage.setItem('pantre_local_wish_recipes', JSON.stringify(items));
      this.triggerListeners('sync', { event: recipe.id ? 'UPDATE_WISH' : 'INSERT_WISH', item: savedItem });
      return { data: savedItem, error: null };
    }

    const household = await this.getHousehold();
    if (!household) return { error: 'ユーザー世帯が無効です' };

    const payload = {
      ...recipe,
      household_id: household.id
    };

    let result;
    if (recipe.id) {
      result = await this.supabase
        .from('wish_recipes')
        .update(payload)
        .eq('id', recipe.id)
        .select()
        .single();
    } else {
      result = await this.supabase
        .from('wish_recipes')
        .insert(payload)
        .select()
        .single();
    }

    if (!result.error) {
      this.triggerListeners('sync', { event: recipe.id ? 'UPDATE_WISH' : 'INSERT_WISH', item: result.data });
    }
    return result;
  }

  async deleteWishRecipe(id) {
    if (!this.isCloudMode) {
      const items = JSON.parse(localStorage.getItem('pantre_local_wish_recipes') || '[]');
      const filtered = items.filter(i => i.id !== id);
      localStorage.setItem('pantre_local_wish_recipes', JSON.stringify(filtered));
      this.triggerListeners('sync', { event: 'DELETE_WISH', id });
      return { error: null };
    }

    const result = await this.supabase
      .from('wish_recipes')
      .delete()
      .eq('id', id);

    if (!result.error) {
      this.triggerListeners('sync', { event: 'DELETE_WISH', id });
    }
    return result;
  }

  // 7. Supabase接続情報の更新
  async setupSupabase(url, key) {
    if (url && key) {
      localStorage.setItem('pantre_supabase_url', url);
      localStorage.setItem('pantre_supabase_key', key);
    } else {
      localStorage.removeItem('pantre_supabase_url');
      localStorage.removeItem('pantre_supabase_key');
    }
    
    this.init(); // 再初期化
    
    // データソースが切り替わったことを通知
    this.triggerListeners('sync', { event: 'DATASOURCE_CHANGED' });
    return this.isCloudMode;
  }
}

const db = new DataService();
