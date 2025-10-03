from playwright.sync_api import sync_playwright, expect
import time

def run_verification():
    with sync_playwright() as p:
        # Usando headless=True por padrao.
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page()

        try:
            # 1. Navegar para a aplicacao
            # A porta do frontend e 4173 conforme o .env
            page.goto("http://localhost:4173", timeout=20000)
            print("Navegou para http://localhost:4173")

            # Aumentar o tempo de espera para garantir que a pagina carregue
            page.wait_for_load_state('networkidle', timeout=15000)

            # 2. Fazer login
            email_input = page.get_by_label("E-mail")
            password_input = page.get_by_label("Senha")
            login_button = page.get_by_role("button", name="Entrar")

            expect(email_input).to_be_visible(timeout=10000)
            print("Campo de email visivel.")

            email_input.fill("admin@garage.local")
            password_input.fill("change-me")
            login_button.click()
            print("Login submetido.")

            # 3. Verificar se o dashboard foi carregado
            dashboard_heading = page.get_by_role("heading", name="Dashboard")
            expect(dashboard_heading).to_be_visible(timeout=15000)
            print("Dashboard carregado com sucesso.")

            # 4. Tirar screenshot
            screenshot_path = "jules-scratch/verification/verification.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot salvo em: {screenshot_path}")

        except Exception as e:
            print(f"Ocorreu um erro durante a verificacao: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")
            print("Screenshot de erro salvo em: jules-scratch/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()