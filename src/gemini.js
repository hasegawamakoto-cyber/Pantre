/* -------------------------------------------------------------
 * PanTré (パントレ) - gemini.js
 * Gemini API クライアント（REST API直接呼び出し）
 * ------------------------------------------------------------- */

class GeminiService {
  constructor() {
    this.apiKey = localStorage.getItem('pantre_gemini_key') || '';
    this.model = 'gemini-2.0-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.chatHistory = [];
  }

  // --- 設定 ---
  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('pantre_gemini_key', key);
  }

  getApiKey() {
    return this.apiKey;
  }

  isConfigured() {
    return !!this.apiKey;
  }

  clearHistory() {
    this.chatHistory = [];
  }

  // --- システムプロンプト構築 ---
  buildSystemPrompt(foodItems, categories, mealPlans, wishRecipes) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const todayDay = dayNames[today.getDay()];

    // 食材リストの構築
    let foodListText = '（登録食材なし）';
    if (foodItems && foodItems.length > 0) {
      foodListText = foodItems.map(item => {
        const cat = categories?.find(c => c.id === item.category_id);
        const catName = cat ? cat.name : '不明';
        let expiryInfo = '期限未設定';
        if (item.expiration_date) {
          const expDate = new Date(item.expiration_date);
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            expiryInfo = `期限切れ(${Math.abs(diffDays)}日超過)`;
          } else if (diffDays === 0) {
            expiryInfo = '今日まで';
          } else {
            expiryInfo = `あと${diffDays}日 (${item.expiration_date})`;
          }
        }
        return `- ${item.name}: ${item.quantity}${item.unit} [${catName}] ${expiryInfo}${item.memo ? ' メモ:' + item.memo : ''}`;
      }).join('\n');
    }

    // 献立予定の構築
    let mealPlanText = '（献立予定なし）';
    if (mealPlans && mealPlans.length > 0) {
      mealPlanText = mealPlans.map(plan => {
        const mealTypes = { breakfast: '朝', lunch: '昼', dinner: '夜', snack: '間食' };
        const typeLabel = mealTypes[plan.meal_type] || plan.meal_type;
        return `- ${plan.planned_date} ${typeLabel}: ${plan.title}${plan.is_eating_out ? ' (外食)' : ''}${plan.status === 'completed' ? ' ✅完了' : ''}`;
      }).join('\n');
    }

    // 作りたいものリスト
    let wishText = '（なし）';
    if (wishRecipes && wishRecipes.length > 0) {
      wishText = wishRecipes.filter(w => !w.is_completed).map(w => `- ${w.title}${w.notes ? ': ' + w.notes : ''}`).join('\n');
    }

    // カテゴリ一覧
    const categoryList = categories?.map(c => `${c.icon} ${c.name} (ID: ${c.id})`).join(', ') || '冷蔵庫, 冷凍庫, 調味料, 乾物・缶詰, 常温ストック, 飲料';

    return `あなたは「PanTré（パントレ）」という食材管理・献立アシスタントです。
一人暮らしや家庭の自炊を全力でサポートしてください。

## 今日の日付
${todayStr}（${todayDay}曜日）

## 現在の食材ストック
${foodListText}

## カテゴリ一覧
${categoryList}

## 今後の献立予定
${mealPlanText}

## 作りたいものリスト
${wishText}

## あなたの役割
1. ユーザーが雑に入力した食材情報（テキストや音声）を正確に構造化して登録する
2. 食材の賞味期限が不明な場合は購入日や保存方法から一般的な目安を推定する
3. 期限が近い食材を優先的に使うレシピを提案する
4. 献立の登録・管理をサポートする
5. 料理ごとの概算カロリー・PFCバランス・コストを計算する
6. 「作りたいものリスト」の管理をサポートする
7. 食材消費の報告を受けたら在庫の更新を提案する

## 応答フォーマット
必ず以下のJSON形式で応答してください。マークダウンのコードブロック無しで、純粋なJSONのみを返してください。

{
  "message": "ユーザーに表示するメッセージ（自然な日本語、マークダウン使用可）",
  "actions": [
    アクションがあれば以下の形式で配列に入れる。なければ空配列 []
  ]
}

## アクション種別

### 食材登録
{
  "type": "register_food",
  "items": [
    {
      "name": "食材名",
      "quantity": 数値,
      "unit": "単位（個, パック, 本, 袋, g, ml, 缶, 瓶, 束, 丁, 枚, 株）",
      "category_name": "カテゴリ名（冷蔵庫, 冷凍庫, 調味料, 乾物・缶詰, 常温ストック, 飲料）",
      "expiration_date": "YYYY-MM-DD形式（不明なら推定して記入）",
      "memo": "備考（任意）"
    }
  ]
}

### 食材消費・更新
{
  "type": "consume_food",
  "items": [
    {
      "name": "食材名（既存の食材名と一致させること）",
      "action": "consume_all（全消費）or reduce（一部消費）or update（情報更新）",
      "reduce_amount": 減らす量（reduceの場合のみ）
    }
  ]
}

### 献立登録
{
  "type": "register_meal_plan",
  "plans": [
    {
      "planned_date": "YYYY-MM-DD",
      "meal_type": "dinner（夜）/ lunch（昼）/ breakfast（朝）/ snack（間食）",
      "title": "料理名",
      "description": "説明",
      "ingredients": ["食材1", "食材2"],
      "estimated_calories": 概算カロリー（kcal、整数）,
      "estimated_pfc": {"protein": "high/medium/low", "fat": "high/medium/low", "carb": "high/medium/low"},
      "estimated_cost": 概算コスト（円、整数）,
      "is_eating_out": false
    }
  ]
}

### レシピ提案（提案のみ、登録はユーザー確認後）
{
  "type": "suggest_recipe",
  "recipes": [
    {
      "title": "料理名",
      "ingredients": ["食材1: 量", "食材2: 量"],
      "priority_reason": "この食材を優先すべき理由",
      "cooking_time": "調理時間（分）",
      "difficulty": "easy/medium/hard",
      "estimated_calories": 概算kcal,
      "estimated_pfc": {"protein": "...", "fat": "...", "carb": "..."},
      "estimated_cost": 概算コスト（円）,
      "steps": ["手順1", "手順2", "..."],
      "health_benefit": "期待できる健康面のメリット"
    }
  ]
}

### 作りたいものリスト追加
{
  "type": "add_wish_recipe",
  "recipes": [
    {
      "title": "料理名",
      "notes": "メモ"
    }
  ]
}

## 重要なルール
- 応答は必ず上記のJSON形式のみにすること
- messageフィールドではマークダウンを使って読みやすくフォーマットすること
- 食材登録時、カテゴリ名は必ず既存カテゴリ名と一致させること
- 期限日が不明な場合は購入日や食材の一般的な保存期間から推定すること
- ユーザーの口調がカジュアルでも丁寧に、しかしフレンドリーに対応すること
- 消費・調理報告があった場合は、必ず consume_food アクションで在庫更新を提案すること
- レシピ提案時は、期限の近い食材を最優先で使い切る献立にすること
- 外食の報告があった場合も、メニュー名から推定カロリー・PFC・コストを算出すること`;
  }

  // --- Gemini API 呼び出し ---
  async sendMessage(userMessage, context = {}) {
    if (!this.isConfigured()) {
      return {
        message: '⚙️ Gemini APIキーが設定されていません。\n\n設定画面の「AI設定 (Gemini)」から、Google AI StudioのAPIキーを入力してください。',
        actions: []
      };
    }

    const { foodItems, categories, mealPlans, wishRecipes } = context;
    const systemPrompt = this.buildSystemPrompt(foodItems, categories, mealPlans, wishRecipes);

    // チャット履歴にユーザーメッセージを追加
    this.chatHistory.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    // API リクエストの組み立て
    const requestBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: this.chatHistory,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error('AIからの応答が空です');
      }

      // チャット履歴にAI応答を追加
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: responseText }]
      });

      // 履歴が長くなりすぎたら古いものを削除（直近20往復を保持）
      if (this.chatHistory.length > 40) {
        this.chatHistory = this.chatHistory.slice(-40);
      }

      // JSONをパース
      return this.parseResponse(responseText);

    } catch (error) {
      console.error('Gemini API エラー:', error);

      // エラー時は履歴から最後のユーザーメッセージを削除
      this.chatHistory.pop();

      return {
        message: `❌ AIへのリクエストでエラーが発生しました。\n\n**エラー内容:** ${error.message}\n\n再度お試しいただくか、設定画面でAPIキーを確認してください。`,
        actions: [],
        error: true
      };
    }
  }

  // --- レスポンスのパース ---
  parseResponse(text) {
    try {
      // JSONをパース
      const parsed = JSON.parse(text);

      return {
        message: parsed.message || 'AIからの応答を処理できませんでした。',
        actions: Array.isArray(parsed.actions) ? parsed.actions : []
      };
    } catch (e) {
      // JSON部分を抽出するフォールバック
      console.warn('JSON パース失敗、フォールバック処理:', e);

      // コードブロック内のJSONを探す
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          return {
            message: parsed.message || text,
            actions: Array.isArray(parsed.actions) ? parsed.actions : []
          };
        } catch (e2) {
          // ignore
        }
      }

      // { } で囲まれた部分を探す
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          const parsed = JSON.parse(braceMatch[0]);
          return {
            message: parsed.message || text,
            actions: Array.isArray(parsed.actions) ? parsed.actions : []
          };
        } catch (e3) {
          // ignore
        }
      }

      // 完全にパースできない場合はテキストをそのまま返す
      return {
        message: text,
        actions: []
      };
    }
  }

  // --- レポート生成用 ---
  async generateMonthlyReport(context) {
    const { foodItems, categories, mealLogs, mealPlans } = context;
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = today.toISOString().split('T')[0];

    const reportPrompt = `以下のデータを分析して、${today.getFullYear()}年${today.getMonth() + 1}月の月間サマリーレポートを作成してください。

## 今月の食事記録
${mealLogs?.map(log => `- ${log.logged_date}: ${log.title} (${log.actual_calories || '?'}kcal, ¥${log.actual_cost || '?'}) ${log.is_eating_out ? '[外食]' : '[自炊]'}`).join('\n') || '記録なし'}

## 今月の献立予定
${mealPlans?.map(plan => `- ${plan.planned_date}: ${plan.title} (${plan.status}) ${plan.is_eating_out ? '[外食]' : ''}`).join('\n') || '予定なし'}

## 現在の食材ストック
${foodItems?.map(item => `- ${item.name}: ${item.quantity}${item.unit}`).join('\n') || 'なし'}

以下の項目についてレポートを生成してください：
1. **食材管理サマリー**: 登録・消費・廃棄の傾向
2. **健康状態サマリー**: カロリー・PFCバランスの傾向
3. **コストサマリー**: 食費の内訳（自炊 vs 外食）
4. **食事レパートリ**: 作った料理の傾向・バリエーション
5. **料理スキル評価**: 料理の難易度・バリエーションから推定
6. **来月へのアドバイス**: 改善ポイントや提案

レポートは読みやすいマークダウン形式で、データに基づいた具体的な分析をお願いします。`;

    // レポートは通常のチャットとは別のリクエスト
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: reportPrompt }]
      }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 8192
      }
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'レポートの生成に失敗しました。';
    } catch (error) {
      console.error('レポート生成エラー:', error);
      return `❌ レポート生成エラー: ${error.message}`;
    }
  }
}

const gemini = new GeminiService();
