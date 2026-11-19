"""Capture both checkouts in Firefox with synthetic fixtures."""
import base64
from contextlib import ExitStack
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time


ROOT = Path.cwd()
OUTPUT = ROOT / "tmp/validation"
CAPTURES = OUTPUT / "capturas"
FRONTENDS = {
    "v019": ROOT / "frontend",
    "v016-custom": OUTPUT / "reference/frontend",
}
CAPTURES.mkdir(exist_ok=True)


def until(fn, *, timeout=7, otherwise="condition"):
    limit = time.monotonic() + timeout
    while time.monotonic() < limit:
        try:
            result = fn()
            if result:
                return result
        except (ConnectionError, TimeoutError):
            pass
        time.sleep(.15)
    raise RuntimeError(f"Timed out waiting for {otherwise}")


class Marionette:
    def __init__(self, sock):
        self.sock = sock
        self.reader = sock.makefile("rb")
        self.request = 0
        self.read()

    def read(self):
        size = bytearray()
        while (char := self.reader.read(1)) != b":":
            if not char:
                raise ConnectionError("Marionette disconnected")
            size.extend(char)
        return json.loads(self.reader.read(int(size)))

    def call(self, command, **parameters):
        self.request += 1
        message = json.dumps([0, self.request, command, parameters]).encode()
        self.sock.sendall(str(len(message)).encode() + b":" + message)
        _, _, error, result = self.read()
        if error:
            raise RuntimeError(f"{command}: {error}")
        return result.get("value") if isinstance(result, dict) and "value" in result else result

    def js(self, script):
        return self.call("WebDriver:ExecuteScript", script=script, args=[], newSandbox=True)

    def capture(self, label):
        data = self.call("WebDriver:TakeScreenshot", full=False, highlights=[])
        path = CAPTURES / f"{label}.png"
        path.write_bytes(base64.b64decode(data))
        print(path.name, self.js("return [innerWidth, innerHeight]"), flush=True)


def wait_text(browser, text, selector="body"):
    until(lambda: browser.js(rf"""
        return [...document.querySelectorAll({json.dumps(selector)})]
          .some(el => el.textContent.toLocaleLowerCase().includes({json.dumps(text)}.toLocaleLowerCase()))
    """), otherwise=f"{text} in {selector}")


def click(browser, name, selector="button, [role=button], a"):
    until(lambda: browser.js(rf"""
        const expected = {json.dumps(name)}.toLocaleLowerCase();
        const elements = [...document.querySelectorAll({json.dumps(selector)})];
        const item = elements.find(el => el.getAttribute('aria-label')?.toLocaleLowerCase() === expected ||
            el.textContent.trim().toLocaleLowerCase().replace(/\s+/g, ' ') === expected) ??
          elements.find(el => el.textContent.trim().toLocaleLowerCase().replace(/\s+/g, ' ').startsWith(expected));
        if (!item) return false;
        item.scrollIntoView({{ block: 'nearest', inline: 'nearest' }});
        if (item instanceof SVGElement) item.dispatchEvent(new MouseEvent('click', {{ bubbles: true }}));
        else item.click();
        return true;
    """), otherwise=f"click {name}")


def start_process(stack, name, command, cwd, env=None):
    log = stack.enter_context((OUTPUT / f"{name}.log").open("w"))
    process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT)
    def stop():
        if process.poll() is not None:
            return
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    stack.callback(stop)
    return process


with ExitStack() as stack:
    for port, (version, frontend) in zip((55492, 55493), FRONTENDS.items(), strict=True):
        start_process(
            stack, f"vite-{version}",
            ["node", "node_modules/vite/bin/vite.js", "--config", "tmp/securo-visual/vite.config.ts", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
            frontend, {**os.environ, "VITE_APP_VERSION": "0.19.0" if version == "v019" else "0.16.6"},
        )
    profile = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="securo-firefox-")))
    (profile / "user.js").write_text(
        'user_pref("marionette.port", 55494);\n'
        'user_pref("browser.shell.checkDefaultBrowser", false);\n'
        'user_pref("browser.startup.homepage", "about:blank");\n'
        'user_pref("network.manage-offline-status", false);\n'
    )
    firefox = start_process(
        stack, "firefox",
        ["firefox", "--headless", "--no-remote", "--profile", str(profile), "--marionette", "about:blank"],
        ROOT,
    )
    def connect():
        if firefox.poll() is not None:
            raise RuntimeError("Firefox exited before starting Marionette")
        return socket.create_connection(("127.0.0.1", 55494), timeout=1)
    connection = stack.enter_context(until(connect, otherwise="Firefox Marionette"))
    connection.settimeout(90)
    browser = Marionette(connection)
    browser.call("WebDriver:NewSession", capabilities={"alwaysMatch": {"browserName": "firefox"}})
    from sys import argv
    only = set(argv[1:])
    tasks = [
        ("filtros", False, False, None),
        ("despesa", False, False, "Mercado sintético"),
        ("receita-mascara", True, True, "Salário sintético"),
        ("tendencia", False, False, None),
        ("transacoes", False, False, "Mercado sintético"),
    ]
    for name, width, height in [("desktop", 1366, 900), ("mobile", 390, 844)]:
        browser.call("WebDriver:SetWindowRect", width=width, height=height)
        for port, version in zip((55492, 55493), FRONTENDS, strict=True):
            if only and version not in only:
                continue
            for label, privacy, dark, category in tasks:
                target = CAPTURES / f"{version}-{name}-{label}.png"
                if target.exists() and "replace" not in only:
                    continue
                print(f"{version} {name} {label}", flush=True)
                try:
                    browser.call(
                        "WebDriver:Navigate",
                        url=f"http://127.0.0.1:{port}/tmp/securo-visual/index.html?privacy={int(privacy)}&dark={int(dark)}",
                    )
                    try:
                        click(browser, "Receitas vs Despesas")
                    except RuntimeError:
                        browser.call("WebDriver:Refresh")
                        click(browser, "Receitas vs Despesas")
                    wait_text(browser, "Mercado sintético")
                    if label == "filtros":
                        click(browser, "Filtros")
                        wait_text(browser, "Lançamento da transação" if version == "v016-custom" else "Status da transação", '[role="dialog"]')
                    elif category:
                        click(browser, category)
                        wait_text(browser, category, '[role="dialog"]')
                        wait_text(browser, "Ver transações", '[role="dialog"]')
                        if label == "transacoes":
                            click(browser, "Ver transações", '[role="dialog"] a')
                            wait_text(browser, "Compra no mercado")
                    elif label == "tendencia":
                        browser.js("""
                            const heading = [...document.querySelectorAll('p')]
                              .find(el => el.textContent === 'Tendência por Categoria');
                            heading?.scrollIntoView({block: 'center'});
                        """)
                    time.sleep(.4)
                    browser.capture(f"{version}-{name}-{label}")
                except RuntimeError as error:
                    print(version, name, label, str(error), flush=True)
                    print(browser.js("return document.body.innerText.slice(0, 600)"), flush=True)
    browser.call("WebDriver:DeleteSession")
