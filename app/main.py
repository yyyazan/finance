"""Dash app entry point.

Exports `server` for gunicorn (`gunicorn app.main:server`).
M0 scaffold — real layout and pages land in M2/M3.
"""
from dash import Dash, html

app = Dash(__name__, use_pages=False, suppress_callback_exceptions=True)
server = app.server

app.layout = html.Div(
    children=[
        html.H1("Portfolio"),
        html.P("M0 boot check — Dash + gunicorn surface is live."),
    ]
)


@server.route("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(debug=True, port=8050)
