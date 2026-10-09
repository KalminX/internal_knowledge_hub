import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000"
RECORDINGS_DIR = "/Users/kalmin/projects/internal_knowledge_hub/demo_recording"
RAW_VIDEO_DIR = os.path.join(RECORDINGS_DIR, "raw_videos")
FINAL_VIDEO_PATH = os.path.join(RECORDINGS_DIR, "application-demo-720p.mp4")

CURSOR_SCRIPT = """
(function() {
    if (document.getElementById('demo-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.position = 'fixed';
    cursor.style.top = '0';
    cursor.style.left = '0';
    cursor.style.width = '18px';
    cursor.style.height = '18px';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '999999';
    cursor.style.transform = 'translate(-2px, -2px)';
    cursor.style.transition = 'transform 0.08s ease-out, opacity 0.2s ease';
    cursor.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
            <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="#3b82f6" stroke="#ffffff" stroke-width="1.75" stroke-linejoin="round"/>
        </svg>
    `;
    document.body.appendChild(cursor);

    const ripple = document.createElement('div');
    ripple.id = 'demo-click-ripple';
    ripple.style.position = 'fixed';
    ripple.style.width = '24px';
    ripple.style.height = '24px';
    ripple.style.borderRadius = '50%';
    ripple.style.backgroundColor = 'rgba(59, 130, 246, 0.4)';
    ripple.style.border = '2px solid rgba(255, 255, 255, 0.9)';
    ripple.style.pointerEvents = 'none';
    ripple.style.zIndex = '999998';
    ripple.style.opacity = '0';
    ripple.style.transform = 'translate(-50%, -50%) scale(0.2)';
    ripple.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    document.body.appendChild(ripple);

    window.__updateCursor = function(x, y) {
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
    };

    window.__clickPulse = function(x, y) {
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.style.transform = 'translate(-50%, -50%) scale(1)';
        ripple.style.opacity = '1';
        setTimeout(() => {
            ripple.style.transform = 'translate(-50%, -50%) scale(1.8)';
            ripple.style.opacity = '0';
        }, 150);
    };
})();
"""

class VisualController:
    def __init__(self, page):
        self.page = page
        self.cur_x = 640
        self.cur_y = 360
        self.inject_cursor()

    def inject_cursor(self):
        try:
            self.page.evaluate(CURSOR_SCRIPT)
            self.page.evaluate(f"window.__updateCursor({self.cur_x}, {self.cur_y})")
        except Exception:
            pass

    def move_to(self, x, y, steps=20, delay=0.015):
        self.inject_cursor()
        dx = (x - self.cur_x) / steps
        dy = (y - self.cur_y) / steps
        for i in range(steps):
            self.cur_x += dx
            self.cur_y += dy
            self.page.mouse.move(self.cur_x, self.cur_y)
            try:
                self.page.evaluate(f"window.__updateCursor({self.cur_x}, {self.cur_y})")
            except Exception:
                pass
            time.sleep(delay)
        self.cur_x = x
        self.cur_y = y
        self.page.mouse.move(x, y)
        try:
            self.page.evaluate(f"window.__updateCursor({x}, {y})")
        except Exception:
            pass

    def move_to_element(self, selector, steps=22, delay=0.012):
        self.inject_cursor()
        loc = self.page.locator(selector).first
        loc.wait_for(state="visible", timeout=7000)
        box = loc.bounding_box()
        if box:
            target_x = box['x'] + box['width'] / 2
            target_y = box['y'] + box['height'] / 2
            self.move_to(target_x, target_y, steps=steps, delay=delay)
            return target_x, target_y
        return self.cur_x, self.cur_y

    def click_element(self, selector, pause_after=0.6):
        target_x, target_y = self.move_to_element(selector)
        try:
            self.page.evaluate(f"window.__clickPulse({target_x}, {target_y})")
        except Exception:
            pass
        self.page.locator(selector).first.click()
        time.sleep(pause_after)

    def type_text(self, selector, text, wpm_delay=0.045):
        self.click_element(selector, pause_after=0.3)
        for char in text:
            self.page.keyboard.type(char)
            time.sleep(wpm_delay)
        time.sleep(0.4)


def run_demo_recording():
    os.makedirs(RAW_VIDEO_DIR, exist_ok=True)

    print("🚀 Starting Playwright recording session...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=RAW_VIDEO_DIR,
            record_video_size={"width": 1280, "height": 720},
            device_scale_factor=1,
        )

        page = context.new_page()
        vc = VisualController(page)

        # ----------------------------------------------------
        # SCENE 1: Introduction & Knowledge Hub Overview
        # ----------------------------------------------------
        print("🎬 Scene 1: Knowledge Hub Overview...")
        page.goto(f"{BASE_URL}/chat/")
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.0)

        # Ensure Alex Rivera (Member/Engineer) is active
        page.select_option("select[name='user_id']", "33333333-3333-3333-3333-333333333333")
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.5)

        # Hover over persona badge & top header
        vc.move_to(120, 110, steps=15)
        time.sleep(0.8)
        vc.move_to(640, 25, steps=20)
        time.sleep(0.8)

        # ----------------------------------------------------
        # SCENE 2: Real-Time Grounded Query & SSE Token Streaming
        # ----------------------------------------------------
        print("🎬 Scene 2: Grounded Query & Real-Time Streaming...")
        # Start a clean thread
        vc.click_element("a[title='Start new thread']", pause_after=0.8)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.0)

        # Hover over benchmark chip and click or type
        pto_query = "How many days of PTO can I roll over into the new year and what is the deadline?"
        vc.type_text("#chatInput", pto_query, wpm_delay=0.035)
        vc.click_element("#chatSendBtn", pause_after=0.4)

        # Wait for streaming to complete
        print("Waiting for SSE streaming...")
        page.wait_for_selector(".cit-card", state="visible", timeout=12000)
        time.sleep(2.0)

        # Scroll to inspect verified citations
        vc.move_to(700, 520, steps=18)
        time.sleep(1.0)

        # Click Helpful feedback button
        vc.click_element("button[title='Mark Helpful']", pause_after=1.2)
        time.sleep(1.5)

        # ----------------------------------------------------
        # SCENE 3: RBAC Security Boundary & Safe Abstention
        # ----------------------------------------------------
        print("🎬 Scene 3: Security Boundary & Insufficient Evidence Abstention...")
        restricted_query = "What is the leadership equity vesting schedule and bonus formula?"
        vc.type_text("#chatInput", restricted_query, wpm_delay=0.035)
        vc.click_element("#chatSendBtn", pause_after=0.5)

        # Wait for abstention block
        page.wait_for_selector("button:has-text('Submit to Knowledge Gaps')", state="visible", timeout=10000)
        time.sleep(1.8)

        # Click submit gap
        vc.click_element("button:has-text('Submit to Knowledge Gaps')", pause_after=1.5)
        time.sleep(1.5)

        # ----------------------------------------------------
        # SCENE 4: Admin Role Elevation & Restricted Access
        # ----------------------------------------------------
        print("🎬 Scene 4: Elevating to Sarah Connor (Admin)...")
        vc.move_to_element("select[name='user_id']", steps=20)
        page.select_option("select[name='user_id']", "11111111-1111-1111-1111-111111111111")
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.5)

        # Re-run executive query as Owner
        print("Asking restricted question as Owner...")
        vc.type_text("#chatInput", restricted_query, wpm_delay=0.035)
        vc.click_element("#chatSendBtn", pause_after=0.5)

        # Wait for streaming of authorized executive response
        page.wait_for_selector(".cit-card", state="visible", timeout=10000)
        time.sleep(2.5)

        # ----------------------------------------------------
        # SCENE 5: Document Library & Ingestion Lifecycle
        # ----------------------------------------------------
        print("🎬 Scene 5: Document Library & Lifecycle Management...")
        vc.click_element("a[href='/documents/']", pause_after=1.2)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.2)

        # Open Permissions modal
        vc.click_element("button:has-text('Permissions')", pause_after=1.0)
        time.sleep(1.5)
        vc.click_element("#rulesModal button:has-text('Cancel')", pause_after=0.8)

        # Demonstrate instant document retirement
        print("Demonstrating instant document retirement...")
        vc.click_element("form[action*='retire'] button", pause_after=1.5)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.5)

        # Reactivate document
        vc.click_element("form[action*='retire'] button", pause_after=1.2)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.0)

        # ----------------------------------------------------
        # SCENE 6: Operational Telemetry & Knowledge Gaps Triage
        # ----------------------------------------------------
        print("🎬 Scene 6: Analytics & Knowledge Gaps Workflow...")
        vc.click_element("a[href='/analytics/']", pause_after=1.2)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(2.0)

        # Hover over metric cards
        vc.move_to(350, 160, steps=15)
        time.sleep(0.8)
        vc.move_to(650, 160, steps=15)
        time.sleep(0.8)

        # Navigate to Knowledge Gaps
        vc.click_element("a[href='/gaps/']", pause_after=1.2)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(1.5)

        # Update gap status to In Review
        if page.locator("#gapsTbody select").count() > 0:
            vc.move_to_element("#gapsTbody select", steps=15)
            page.locator("#gapsTbody select").first.select_option("reviewed")
            page.wait_for_load_state("networkidle")
            vc.inject_cursor()
            time.sleep(1.5)

        # ----------------------------------------------------
        # SCENE 7: Security Audit Stream & Connectors Spec
        # ----------------------------------------------------
        print("🎬 Scene 7: Security Audit Stream & Cloud Connectors...")
        vc.click_element("a[href='/audit/']", pause_after=1.2)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(2.0)

        # Navigate to Cloud Connectors
        vc.click_element("a[href='/integrations/']", pause_after=1.2)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(2.0)

        # Return to Chat for clean final frame
        vc.click_element("a[href='/chat/']", pause_after=1.5)
        page.wait_for_load_state("networkidle")
        vc.inject_cursor()
        time.sleep(2.5)

        # Close page and context to flush video
        print("Closing browser and saving video...")
        page.close()
        context.close()
        browser.close()

    # Find the recorded raw webm file
    raw_files = [f for f in os.listdir(RAW_VIDEO_DIR) if f.endswith(".webm")]
    if not raw_files:
        print("❌ Error: No raw video file recorded.")
        sys.exit(1)

    raw_path = os.path.join(RAW_VIDEO_DIR, raw_files[0])
    print(f"📹 Raw video saved at: {raw_path}")

    # Transcode and compress with FFmpeg to 720p 30fps H.264 yuv420p
    print("🎞️ Transcoding with FFmpeg...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", raw_path,
        "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "26",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        FINAL_VIDEO_PATH
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print(f"✅ Final video generated successfully at: {FINAL_VIDEO_PATH}")

if __name__ == "__main__":
    run_demo_recording()
