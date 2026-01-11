-- ATHENA Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text default 'user' check (role in ('admin', 'user')),
  invited_by uuid references public.profiles(id),
  invite_code text,
  is_suspended boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Invite codes table
create table if not exists public.invite_codes (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  created_by uuid references public.profiles(id) not null,
  created_at timestamp with time zone default now(),
  is_used boolean default false,
  used_by uuid references public.profiles(id),
  used_at timestamp with time zone
);

-- Enable RLS
alter table public.invite_codes enable row level security;

-- Invite codes policies
create policy "Admins can manage invite codes"
  on public.invite_codes for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Anyone can verify invite codes"
  on public.invite_codes for select
  using (true);

-- Function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, invite_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'invite_code'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Meta integrations table
create table if not exists public.meta_integrations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  access_token text not null,
  token_expires_at timestamp with time zone,
  ad_account_id text,
  page_id text,
  pixel_id text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.meta_integrations enable row level security;

create policy "Users can manage own integrations"
  on public.meta_integrations for all
  using (auth.uid() = user_id);

-- Insert first admin (run this after creating your first user)
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
