-- =============================================================
-- PanTré (パントレ) - Supabase データベーススキーマ
-- Supabase の SQL Editor に貼り付けて実行するだけでデータベースが自動構築されます。
-- =============================================================

-- 1. ユーザー公開プロフィールテーブル
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text
);

-- 自動でプロフィールレコードを作成するトリガー関数
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', '家族メンバー'),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

-- トリガーの作成
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- トリガー関数のプロファイル取得ヘルパー (main.jsで使用)
create or replace function public.get_user_profile(user_id_param uuid)
returns json as $$
declare
  profile_record record;
begin
  select display_name, email into profile_record from public.profiles where id = user_id_param;
  return row_to_json(profile_record);
end;
$$ language plpgsql security definer;


-- 2. 世帯（家庭グループ）テーブル
create table public.households (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- 3. 世帯メンバー（家族共有）中間テーブル
create table public.household_members (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member'::text not null, -- 'owner' または 'member'
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(household_id, user_id)
);


-- 4. カテゴリ（保管場所）テーブル
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  icon text not null,
  sort_order integer not null,
  is_default boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- 5. 食材ストックテーブル
create table public.food_items (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  registered_by uuid references auth.users(id) on delete set null,
  name text not null,
  quantity numeric not null default 1.0,
  unit text not null default '個'::text,
  expiration_date date,
  memo text,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- =============================================================
-- セキュリティ設定 (Row Level Security - RLS)
-- 同じ世帯（household_id）に属する家族メンバーだけがデータを読み書きできるようにします。
-- =============================================================

-- 全テーブルの RLS を有効化
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.food_items enable row level security;

-- 1. プロフィールのポリシー
create policy "誰でも自身のプロフィールを参照可能"
  on public.profiles for select
  using (auth.uid() = id);

create policy "ユーザー自身によるプロフィールの更新"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. 世帯のポリシー
create policy "所属している世帯情報のみ参照可能"
  on public.households for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = households.id
      and household_members.user_id = auth.uid()
    )
  );

create policy "新規世帯の作成を全ユーザーに許可"
  on public.households for insert
  with check (true);

-- 3. 世帯メンバーのポリシー
create policy "同じ世帯のメンバー情報を参照可能"
  on public.household_members for select
  using (
    exists (
      select 1 from public.household_members self
      where self.household_id = household_members.household_id
      and self.user_id = auth.uid()
    )
  );

create policy "新規世帯への参加を許可"
  on public.household_members for insert
  with check (auth.uid() = user_id);

create policy "世帯からの脱退または管理者権限での削除"
  on public.household_members for delete
  using (
    auth.uid() = user_id 
    or exists (
      select 1 from public.household_members self
      where self.household_id = household_members.household_id
      and self.user_id = auth.uid()
      and self.role = 'owner'
    )
  );

-- 4. カテゴリのポリシー
create policy "同じ世帯のカテゴリのみ参照可能"
  on public.categories for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = categories.household_id
      and household_members.user_id = auth.uid()
    )
  );

create policy "同じ世帯のカテゴリの追加・更新・削除を許可"
  on public.categories for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = categories.household_id
      and household_members.user_id = auth.uid()
    )
  );

-- 5. 食材ストックのポリシー
create policy "同じ世帯の食材のみ参照可能"
  on public.food_items for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = food_items.household_id
      and household_members.user_id = auth.uid()
    )
  );

create policy "同じ世帯の食材の追加・更新・削除を許可"
  on public.food_items for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = food_items.household_id
      and household_members.user_id = auth.uid()
    )
  );


-- =============================================================
-- 新規追加：AI献立・記録・チャット用テーブル
-- =============================================================

-- 6. 献立予定テーブル
create table public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  planned_date date not null,
  meal_type text default 'dinner' not null, -- 'breakfast', 'lunch', 'dinner', 'snack'
  title text not null,
  description text,
  ingredients jsonb, -- 配列や詳細情報
  estimated_calories integer,
  estimated_pfc jsonb, -- {protein: "high/medium/low", fat: "...", carb: "..."} または比率
  estimated_cost integer,
  is_eating_out boolean default false not null,
  status text default 'planned' not null, -- 'planned', 'completed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. 食事記録テーブル
create table public.meal_logs (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  meal_plan_id uuid references public.meal_plans(id) on delete set null,
  logged_date date not null,
  meal_type text default 'dinner' not null,
  title text not null,
  actual_calories integer,
  actual_pfc jsonb,
  actual_cost integer,
  is_eating_out boolean default false not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. AIチャット履歴テーブル
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null, -- 'user' または 'assistant'
  content text not null,
  actions_taken jsonb, -- 実行されたアクションの記録用
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. 作りたいものリストテーブル
create table public.wish_recipes (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  title text not null,
  notes text,
  is_completed boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS を有効化
alter table public.meal_plans enable row level security;
alter table public.meal_logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.wish_recipes enable row level security;

-- meal_plans ポリシー
create policy "同じ世帯の献立予定のみ参照可能"
  on public.meal_plans for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = meal_plans.household_id
      and household_members.user_id = auth.uid()
    )
  );

create policy "同じ世帯の献立予定の追加・更新・削除を許可"
  on public.meal_plans for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = meal_plans.household_id
      and household_members.user_id = auth.uid()
    )
  );

-- meal_logs ポリシー
create policy "同じ世帯の食事記録のみ参照可能"
  on public.meal_logs for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = meal_logs.household_id
      and household_members.user_id = auth.uid()
    )
  );

create policy "同じ世帯の食事記録の追加・更新・削除を許可"
  on public.meal_logs for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = meal_logs.household_id
      and household_members.user_id = auth.uid()
    )
  );

-- chat_messages ポリシー
create policy "同じ世帯のチャット履歴のみ参照可能"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = chat_messages.household_id
      and household_members.user_id = auth.uid()
    )
  );

create policy "同じ世帯のチャット履歴の追加・更新・削除を許可"
  on public.chat_messages for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = chat_messages.household_id
      and household_members.user_id = auth.uid()
    )
  );

-- wish_recipes ポリシー
create policy "同じ世帯の作りたいものリストのみ参照可能"
  on public.wish_recipes for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = wish_recipes.household_id
      and household_members.user_id = auth.uid()
    )
  );

create policy "同じ世帯の作りたいものリストの追加・更新・削除を許可"
  on public.wish_recipes for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = wish_recipes.household_id
      and household_members.user_id = auth.uid()
    )
  );

