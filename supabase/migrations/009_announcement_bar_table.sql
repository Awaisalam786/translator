-- Create site_announcements table for top announcement bar
CREATE TABLE IF NOT EXISTS public.site_announcements (
    id TEXT PRIMARY KEY DEFAULT 'default_announcement',
    message TEXT NOT NULL DEFAULT 'Welcome to LeseLampe! Start reading and translating books today.',
    is_active BOOLEAN NOT NULL DEFAULT true,
    background_color TEXT NOT NULL DEFAULT '#d97706',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    link_url TEXT DEFAULT '',
    is_scrolling BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active announcements
CREATE POLICY "Allow public read access to active announcements"
    ON public.site_announcements
    FOR SELECT
    USING (true);

-- Allow admins full access
CREATE POLICY "Allow admin full access to announcements"
    ON public.site_announcements
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.role() = 'authenticated');

-- Insert default announcement row if not exists
INSERT INTO public.site_announcements (id, message, is_active, background_color, text_color, link_url, is_scrolling)
VALUES ('default_announcement', '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.', true, '#d97706', '#ffffff', '', false)
ON CONFLICT (id) DO NOTHING;
