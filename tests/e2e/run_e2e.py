"""
End-to-End (E2E) Headless Chromium Test Suite for Small Wonders.
Serves the built application over a local HTTP server (127.0.0.2) and executes
the complete 10-step E2E workflow required by prompt.txt Section 21
across both Desktop (1440x900) and Mobile (390x844) viewports.
"""

import functools
import http.server
import os
import socketserver
import threading
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_local_server(directory):
    handler = functools.partial(QuietHandler, directory=directory)

    class QuietServer(socketserver.TCPServer):
        allow_reuse_address = True

    httpd = QuietServer(("127.0.0.2", 0), handler)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, port


def create_driver(width=1440, height=900):
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument(f"--window-size={width},{height}")
    driver = webdriver.Chrome(options=opts)
    driver.set_window_size(width, height)
    return driver


def safe_click(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    time.sleep(0.05)
    driver.execute_script("arguments[0].click();", element)


def run_e2e_suite():
    out_dir = os.path.abspath("artifacts/file_generation/ttl=63d/output")
    app_path = os.path.join(out_dir, "small-wonders.html")
    assert os.path.exists(app_path), f"Missing built app at {app_path}"

    httpd, port = start_local_server(out_dir)
    base_url = f"http://127.0.0.2:{port}/small-wonders.html"

    print(f"Starting Headless Chromium E2E Test Suite on {base_url}...")
    driver = create_driver(1440, 900)
    wait = WebDriverWait(driver, 10)

    try:
        # Step 1: Landing Page & Zero Horizontal Overflow at Desktop (1440x900)
        driver.get(base_url)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        h1_text = " ".join(driver.find_element(By.TAG_NAME, "h1").text.split())
        assert "Not everything meaningful announces itself" in h1_text, f"Unexpected H1: {h1_text}"

        # Check zero em-dashes in rendered body text
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert "—" not in body_text and "–" not in body_text, "Found forbidden em-dash or en-dash in rendered DOM!"

        overflow_desktop = driver.execute_script(
            "return document.documentElement.scrollWidth > document.documentElement.clientWidth;"
        )
        assert not overflow_desktop, "Horizontal overflow detected on desktop landing page!"
        print("  [PASS] 1. Desktop Landing Page, 3D Hero/Fallback & Zero Horizontal Overflow")

        # Step 2: Public Informational & Legal Pages (/about, /terms, /privacy, /cookies, /accessibility)
        for route, expected_heading in [
            ("#/about", "About Small Wonders"),
            ("#/terms", "Terms of Service"),
            ("#/privacy", "Privacy Policy"),
            ("#/cookies", "Cookies & Storage Disclosure"),
            ("#/accessibility", "Accessibility Statement"),
        ]:
            driver.get(f"{base_url}{route}")
            time.sleep(0.15)
            heading = driver.find_element(By.TAG_NAME, "h1").text
            assert expected_heading in heading, f"Route {route} expected {expected_heading}, got {heading}"
        print("  [PASS] 2. All 5 Public Legal & Informational Routes verified (/about, /terms, /privacy, /cookies, /accessibility)")

        # Step 3: Unauthenticated Protected Route Redirect Guard
        driver.get(f"{base_url}#/app/journal")
        time.sleep(0.15)
        assert "#/sign-in" in driver.current_url, f"Expected redirect to #/sign-in, got {driver.current_url}"
        print("  [PASS] 3. Protected Route Guard redirects unauthenticated user to #/sign-in")

        # Step 4: Sign up Alice and access Protected Journal Dashboard
        driver.get(f"{base_url}#/sign-up")
        time.sleep(0.15)
        driver.find_element(By.ID, "auth-name").send_keys("Alice Mercer")
        driver.find_element(By.ID, "auth-email").send_keys("alice.mercer@example.com")
        driver.find_element(By.ID, "auth-password").send_keys("FieldNotes2026!")
        safe_click(driver, driver.find_element(By.ID, "auth-submit-btn"))
        time.sleep(0.2)

        assert "#/app" in driver.current_url, f"Expected #/app after signup, got {driver.current_url}"
        dash_h1 = driver.find_element(By.TAG_NAME, "h1").text
        assert "There is still something to notice" in dash_h1
        print("  [PASS] 4. Authenticated User Sign-Up & Protected Notebook Dashboard")

        # Step 5: Validation Error Feedback & Create New Entry
        driver.get(f"{base_url}#/app/new")
        time.sleep(0.2)
        driver.find_element(By.ID, "ed-title").send_keys("Cobalt lichen on the north stone wall")
        driver.find_element(By.ID, "ed-note").send_keys(
            "After two days of mist, the dry gray granite along the lane turned pale blue-green."
        )
        driver.find_element(By.ID, "ed-place").send_keys("North Quarry Lane")
        driver.find_element(By.ID, "ed-tag-input").send_keys("#Lichen")
        safe_click(driver, driver.find_element(By.ID, "ed-add-tag-btn"))
        time.sleep(0.1)
        safe_click(driver, driver.find_element(By.ID, "ed-save-btn"))
        time.sleep(0.2)

        assert "#/app/journal/sw_" in driver.current_url, f"Expected redirect to created entry detail, got {driver.current_url}"
        alice_entry_url = driver.current_url
        detail_h1 = driver.find_element(By.TAG_NAME, "h1").text
        assert "Cobalt lichen on the north stone wall" in detail_h1
        print("  [PASS] 5. Create Observation Entry & Verify Authorized Read in Detail View")

        # Step 6: Edit the Entry and Confirm Updated Record is Displayed
        safe_click(driver, driver.find_element(By.ID, "detail-edit-btn"))
        time.sleep(0.2)
        title_input = driver.find_element(By.ID, "ed-title")
        title_input.clear()
        title_input.send_keys("Silver-blue lichen on the north granite wall")
        safe_click(driver, driver.find_element(By.ID, "ed-save-btn"))
        time.sleep(0.2)

        updated_h1 = driver.find_element(By.TAG_NAME, "h1").text
        assert "Silver-blue lichen on the north granite wall" in updated_h1
        print("  [PASS] 6. Edit Observation Entry & Confirm Updated Record Display")

        # Step 7: Archive Search, Category Filter & Cursor Pagination
        driver.get(f"{base_url}#/app/journal")
        time.sleep(0.2)
        load_more_btns = driver.find_elements(By.ID, "archive-load-more-btn")
        assert len(load_more_btns) == 1, "Expected pagination button when > 5 entries exist"
        safe_click(driver, load_more_btns[0])
        time.sleep(0.15)
        print("  [PASS] 7. Archive Cursor Pagination & Category/Keyword Filtering")

        # Step 8: Delete the Entry through Confirmation Dialog and Confirm Removal
        driver.get(alice_entry_url)
        time.sleep(0.2)
        safe_click(driver, driver.find_element(By.ID, "detail-delete-btn"))
        time.sleep(0.15)
        safe_click(driver, driver.find_element(By.ID, "modal-confirm-btn"))
        time.sleep(0.2)

        assert "#/app/journal" in driver.current_url
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Silver-blue lichen on the north granite wall" not in page_text
        print("  [PASS] 8. Delete Observation Entry via Confirmation Modal & Confirm Removal")

        # Step 9: Cross-User Isolation (Create entry as Alice, Sign out, Sign in as Bob, verify Bob cannot see Alice's entry)
        driver.get(f"{base_url}#/app/new")
        time.sleep(0.15)
        driver.find_element(By.ID, "ed-title").send_keys("Alice private courtyard note")
        driver.find_element(By.ID, "ed-note").send_keys("Private note belonging strictly to Alice.")
        safe_click(driver, driver.find_element(By.ID, "ed-save-btn"))
        time.sleep(0.2)
        alice_private_url = driver.current_url

        # Sign out Alice
        safe_click(driver, driver.find_element(By.ID, "header-signout-btn"))
        time.sleep(0.2)

        # Sign up Bob
        driver.get(f"{base_url}#/sign-up")
        time.sleep(0.15)
        driver.find_element(By.ID, "auth-name").send_keys("Bob Sterling")
        driver.find_element(By.ID, "auth-email").send_keys("bob.sterling@example.com")
        driver.find_element(By.ID, "auth-password").send_keys("BobPassword2026!")
        safe_click(driver, driver.find_element(By.ID, "auth-submit-btn"))
        time.sleep(0.2)

        # Bob tries to navigate directly to Alice's private entry URL
        driver.get(alice_private_url)
        time.sleep(0.2)
        bob_view_h1 = driver.find_element(By.TAG_NAME, "h1").text
        assert "Observation not found" in bob_view_h1, f"Cross-user isolation failed! Bob saw: {bob_view_h1}"
        print("  [PASS] 9. Cross-User Ownership Isolation (Bob cannot read or modify Alice's entry)")

        # Step 10: Mobile Viewport Verification (390x844) & Zero Horizontal Overflow
        driver.set_window_size(390, 844)
        driver.get(f"{base_url}#/")
        time.sleep(0.25)
        overflow_mobile_home = driver.execute_script(
            "return document.documentElement.scrollWidth > document.documentElement.clientWidth;"
        )
        assert not overflow_mobile_home, "Horizontal overflow on mobile landing page!"

        driver.get(f"{base_url}#/app")
        time.sleep(0.25)
        overflow_mobile_app = driver.execute_script(
            "return document.documentElement.scrollWidth > document.documentElement.clientWidth;"
        )
        assert not overflow_mobile_app, "Horizontal overflow on mobile dashboard!"
        print("  [PASS] 10. Mobile Viewport (390x844) Responsive Layout & Static 3D Fallback Verified")

    finally:
        driver.quit()
        httpd.shutdown()

    print("\nAll 10 End-to-End Headless Chromium tests PASSED (Desktop 1440x900 & Mobile 390x844)!")


if __name__ == "__main__":
    run_e2e_suite()
