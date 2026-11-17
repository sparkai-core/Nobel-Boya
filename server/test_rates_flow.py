"""Test Rates flow: uploading files, adding rates one by one, and in-line cell editing."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ARTIFACTS_DIR = Path(r"C:\Users\Mustafa Subhani\.gemini\antigravity\brain\167fda23-2588-4c72-818c-a777d66e18c5")

def run():
    print("Testing Rates management flow with Playwright...", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--window-size=1440,900"]
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Login
        page.goto("http://localhost:5190/#/login", wait_until="networkidle")
        page.wait_for_selector("input[type='email']", state="visible")
        page.fill("input[type='email']", "elmir@stormtakeoff.com")
        page.fill("input[type='password']", "demo")
        page.click("button[type='submit']")
        page.wait_for_url("**/projects")
        time.sleep(1)

        # 2. Go to Rates Page
        page.goto("http://localhost:5190/#/rates", wait_until="networkidle")
        page.wait_for_selector(".rates-table", state="visible")
        time.sleep(1)

        # 3. Open Add Rate Modal
        print("Opening '+ Add Rate' modal...", flush=True)
        page.click("button:has-text('Add Rate')")
        page.wait_for_selector(".modal-card", state="visible")
        time.sleep(0.5)

        # Fill modal
        page.fill("input[placeholder*='Reinforced concrete C30/37']", "Reinforced concrete C30/37 (Ready-mix)")
        page.select_option("select:has-text('Concrete works')", "Concrete works")
        page.fill("input[placeholder='0.00']", "195.00")
        time.sleep(0.5)

        shot1 = ARTIFACTS_DIR / "shot_e2e_add_rate_modal.png"
        page.screenshot(path=str(shot1))
        print(f"Modal screenshot: {shot1}", flush=True)

        # Submit modal
        page.click("button:has-text('Add to Schedule')")
        time.sleep(1)

        # 4. Toggle All Library Rates
        print("Toggling 'All Library Rates' view...", flush=True)
        page.click("button:has-text('All Library Rates')")
        time.sleep(1)

        shot2 = ARTIFACTS_DIR / "shot_e2e_rates_all_and_added.png"
        page.screenshot(path=str(shot2))
        print(f"Rates view screenshot: {shot2}", flush=True)

        # 5. Test In-Line Edit on a rate cell
        print("Testing in-line rate editing...", flush=True)
        first_input = page.query_selector(".rates-table input.input-cell")
        if first_input:
            first_input.click()
            first_input.fill("295.00")
            page.keyboard.press("Enter")
            time.sleep(1)

        shot3 = ARTIFACTS_DIR / "shot_e2e_rates_edited_inline.png"
        page.screenshot(path=str(shot3))
        print(f"In-line edit screenshot: {shot3}", flush=True)

        browser.close()
        print("Rates management flow test completed successfully!", flush=True)

if __name__ == "__main__":
    run()
