-- Create or upgrade site_announcements for Production Announcement Ticker
CREATE TABLE IF NOT EXISTS public.site_announcements (
    id TEXT PRIMARY KEY DEFAULT 'default_announcement',
    announcement_text TEXT NOT NULL DEFAULT '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    message TEXT NOT NULL DEFAULT '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    enabled BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    speed TEXT NOT NULL DEFAULT 'normal', -- 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast'
    background_color TEXT NOT NULL DEFAULT '#d97706',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    font_size TEXT NOT NULL DEFAULT '14px',
    font_weight TEXT NOT NULL DEFAULT '600',
    pause_on_hover BOOLEAN NOT NULL DEFAULT true,
    loop BOOLEAN NOT NULL DEFAULT true,
    show_icon BOOLEAN NOT NULL DEFAULT true,
    icon TEXT NOT NULL DEFAULT '📢',
    link_url TEXT DEFAULT '',
    is_scrolling BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read access to active announcements" ON public.site_announcements;
CREATE POLICY "Allow public read access to active announcements"
    ON public.site_announcements
    FOR SELECT
    USING (true);

-- Allow admin write access
DROP POLICY IF EXISTS "Allow admin full access to announcements" ON public.site_announcements;
CREATE POLICY "Allow admin full access to announcements"
    ON public.site_announcements
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.role() = 'authenticated');

-- Insert default row if empty
INSERT INTO public.site_announcements (
    id, announcement_text, message, enabled, is_active, speed,
    background_color, text_color, font_size, font_weight,
    pause_on_hover, loop, show_icon, icon, link_url, is_scrolling
) VALUES (
    'default_announcement',
    '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    '🎉 Welcome to LeseLampe! Read German books & tap any word for instant translations.',
    true, true, 'normal',
    '#d97706', '#ffffff', '14px', '600',
    true, true, true, '📢', '', true
)
ON CONFLICT (id) DO UPDATE SET
    speed = EXCLUDED.speed,
    font_size = EXCLUDED.font_size,
    font_weight = EXCLUDED.font_weight,
    pause_on_hover = EXCLUDED.pause_on_hover,
    show_icon = EXCLUDED.show_icon,
    icon = EXCLUDED.icon;
