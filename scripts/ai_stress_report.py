#!/usr/bin/env python3
"""Generate AI-assisted stress test reports from k6 + Prometheus + Loki."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import pathlib
import re
import sys
from typing import Any

try:
    import requests
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: requests. Install with `pip install requests`.") from exc


DEFAULT_PROM_QUERIES = {
    "request_rate_rps": "sum(rate(http_requests_total[1m]))",
    "error_rate_ratio": "sum(rate(http_requests_total{status=~\"5..\"}[1m])) / clamp_min(sum(rate(http_requests_total[1m])), 1)",
    "p95_latency_seconds": "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
    "active_websockets": "sanctum_active_websockets",
    "ws_connections_total": "sanctum_websocket_connections_total",
    "ws_backpressure_drops_5m": "increase(sanctum_websocket_backpressure_drops_total[5m])",
    "db_p95_seconds": "histogram_quantile(0.95, sum by (le) (rate(sanctum_database_query_latency_seconds_bucket[5m])))",
    "message_throughput_rps": "sum(rate(sanctum_message_throughput_total[1m]))",
}


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate AI stress report HTML and JSON artifacts.")
    parser.add_argument("--run-dir", default="", help="Specific run directory containing summary.json")
    parser.add_argument("--artifact-dir", default=os.getenv("ARTIFACT_DIR", "tmp/stress-runs"), help="Base artifact directory")
    parser.add_argument("--profile", default="", help="Optional profile label override")
    parser.add_argument("--prom-url", default=os.getenv("PROM_URL", "http://localhost:9090"))
    parser.add_argument("--loki-url", default=os.getenv("LOKI_URL", "http://localhost:3100"))
    parser.add_argument("--ollama-url", default=os.getenv("OLLAMA_URL", "http://localhost:11434"))
    parser.add_argument("--ollama-model", default=os.getenv("OLLAMA_MODEL", "llama3.2:3b"))
    parser.add_argument("--timeout-seconds", type=int, default=45)
    parser.add_argument("--build-index", action="store_true", help="Build index.html for all report folders")
    return parser.parse_args()


def list_run_dirs(root: pathlib.Path) -> list[pathlib.Path]:
    if not root.exists():
        return []
    return sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.stat().st_mtime)


def resolve_run_dir(args: argparse.Namespace) -> pathlib.Path:
    if args.run_dir:
        run_dir = pathlib.Path(args.run_dir)
        if not run_dir.exists():
            raise SystemExit(f"Run directory not found: {run_dir}")
        return run_dir

    run_dirs = list_run_dirs(pathlib.Path(args.artifact_dir))
    if not run_dirs:
        raise SystemExit("No run directories found. Execute make stress-low/medium/high first.")
    return run_dirs[-1]


def read_json_file(path: pathlib.Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def write_json_file(path: pathlib.Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def to_ns(ts: dt.datetime) -> int:
    return int(ts.timestamp() * 1_000_000_000)


def parse_time_window(metadata: dict[str, Any], fallback_minutes: int = 10) -> tuple[dt.datetime, dt.datetime]:
    start_epoch = metadata.get("start_epoch")
    end_epoch = metadata.get("end_epoch")
    if isinstance(start_epoch, (int, float)) and isinstance(end_epoch, (int, float)) and end_epoch > start_epoch:
        return (
            dt.datetime.fromtimestamp(start_epoch, tz=dt.timezone.utc),
            dt.datetime.fromtimestamp(end_epoch, tz=dt.timezone.utc),
        )

    now = utc_now()
    return now - dt.timedelta(minutes=fallback_minutes), now


def prom_query_range(prom_url: str, query: str, start: dt.datetime, end: dt.datetime, timeout: int) -> dict[str, Any]:
    response = requests.get(
        f"{prom_url.rstrip('/')}/api/v1/query_range",
        params={
            "query": query,
            "start": start.timestamp(),
            "end": end.timestamp(),
            "step": "15s",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def prom_query_instant(prom_url: str, query: str, timeout: int) -> dict[str, Any]:
    response = requests.get(
        f"{prom_url.rstrip('/')}/api/v1/query",
        params={"query": query},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def collect_prometheus(prom_url: str, start: dt.datetime, end: dt.datetime, timeout: int) -> tuple[dict[str, Any], dict[str, Any]]:
    payload: dict[str, Any] = {"window": {"start": start.isoformat(), "end": end.isoformat()}, "queries": {}}
    health: dict[str, Any] = {"status": "ok", "error": ""}

    for name, expr in DEFAULT_PROM_QUERIES.items():
        entry: dict[str, Any] = {"expr": expr}
        try:
            range_data = prom_query_range(prom_url, expr, start, end, timeout)
            instant_data = prom_query_instant(prom_url, expr, timeout)
            entry["range"] = range_data.get("data", {})
            entry["instant"] = instant_data.get("data", {})
        except requests.RequestException as exc:
            entry["error"] = str(exc)
            health["status"] = "degraded"
            health["error"] = f"Prometheus query failure: {exc}"
        payload["queries"][name] = entry

    return payload, health


def collect_loki(loki_url: str, start: dt.datetime, end: dt.datetime, timeout: int) -> tuple[dict[str, Any], dict[str, Any]]:
    query = '{container=~".+"} |~ "(?i)(error|warn|panic|fatal)"'
    payload: dict[str, Any] = {
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "query": query,
        "entries": [],
    }
    health: dict[str, Any] = {"status": "ok", "error": ""}

    try:
        response = requests.get(
            f"{loki_url.rstrip('/')}/loki/api/v1/query_range",
            params={
                "query": query,
                "start": to_ns(start),
                "end": to_ns(end),
                "limit": 200,
                "direction": "BACKWARD",
            },
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json().get("data", {})
        for stream in data.get("result", []):
            labels = stream.get("stream", {})
            for value in stream.get("values", []):
                if len(value) != 2:
                    continue
                ts_ns, line = value
                payload["entries"].append({
                    "timestamp_ns": ts_ns,
                    "line": line,
                    "labels": labels,
                })
    except requests.RequestException as exc:
        health["status"] = "degraded"
        health["error"] = f"Loki query failure: {exc}"

    return payload, health


def read_k6_summary(run_dir: pathlib.Path) -> tuple[dict[str, Any], dict[str, Any]]:
    summary_path = run_dir / "summary.json"
    summary = read_json_file(summary_path, {})
    health = {"status": "ok", "error": ""}
    if not summary:
        health["status"] = "degraded"
        health["error"] = f"Missing or invalid {summary_path}"
    return summary, health


def extract_k6_highlights(summary: dict[str, Any]) -> dict[str, Any]:
    metrics = summary.get("metrics", {}) if isinstance(summary, dict) else {}

    def metric_value(metric_name: str, field: str) -> float | None:
        metric = metrics.get(metric_name, {})
        values = metric.get("values")
        value = None
        if isinstance(values, dict):
            value = values.get(field)
        if value is None and isinstance(metric, dict):
            value = metric.get(field)
        if isinstance(value, (int, float)):
            return float(value)
        return None

    return {
        "http_req_duration_p95_ms": metric_value("http_req_duration", "p(95)"),
        "http_req_failed_rate": metric_value("http_req_failed", "rate") or metric_value("http_req_failed", "value"),
        "checks_pass_rate": metric_value("checks", "rate") or metric_value("checks", "value"),
        "iterations": metric_value("iterations", "count"),
        "vus_max": metric_value("vus_max", "value"),
    }


def parse_model_json(raw_text: str) -> dict[str, Any]:
    raw_text = raw_text.strip()
    if not raw_text:
        return {}

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", raw_text)
    if not match:
        return {}

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


def build_ollama_prompt(profile: str, metadata: dict[str, Any], highlights: dict[str, Any], prom: dict[str, Any], loki: dict[str, Any]) -> str:
    compact = {
        "profile": profile,
        "run_metadata": metadata,
        "k6_highlights": highlights,
        "prometheus_queries": prom.get("queries", {}),
        "loki_error_sample_count": len(loki.get("entries", [])),
        "loki_sample": loki.get("entries", [])[:40],
    }

    return (
        "You are a performance engineer analyzing a stress test run. "
        "Return STRICT JSON only with this schema: "
        "{status,summary,findings[],bottlenecks[],likely_causes[],next_actions[],confidence}. "
        "status must be one of HEALTHY|WARNING|CRITICAL. "
        "confidence must be a number 0..1. "
        "Use concise actionable language.\n\n"
        f"DATA={json.dumps(compact, separators=(',', ':'))}"
    )


def call_ollama(ollama_url: str, model: str, prompt: str, timeout: int) -> tuple[dict[str, Any], dict[str, Any]]:
    health = {"status": "ok", "error": ""}

    try:
        response = requests.post(
            f"{ollama_url.rstrip('/')}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.2, "num_predict": 900},
            },
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        parsed = parse_model_json(payload.get("response", ""))
        if not parsed:
            health["status"] = "degraded"
            health["error"] = "Ollama returned non-JSON response"
        return parsed, health
    except requests.RequestException as exc:
        health["status"] = "degraded"
        health["error"] = f"Ollama request failure: {exc}"
        return {}, health


def default_ai_analysis(profile: str, health_map: dict[str, dict[str, Any]], highlights: dict[str, Any]) -> dict[str, Any]:
    errors = [f"{k}: {v.get('error')}" for k, v in health_map.items() if v.get("status") != "ok" and v.get("error")]
    status = "WARNING" if errors else "HEALTHY"

    return {
        "status": status,
        "summary": f"Fallback analysis for {profile} profile. Partial data was used.",
        "findings": errors or ["No major data-source failures detected during report generation."],
        "bottlenecks": [],
        "likely_causes": [],
        "next_actions": [
            "Verify Prometheus/Loki/Ollama connectivity before next run.",
            "Review k6 summary metrics in summary.json for precise thresholds.",
        ],
        "confidence": 0.35 if errors else 0.6,
        "k6_highlights": highlights,
    }


def format_float(value: Any, digits: int = 4) -> str:
    if isinstance(value, (int, float)):
        return f"{value:.{digits}f}"
    return "N/A"


def render_report_html(
    run_dir: pathlib.Path,
    profile: str,
    metadata: dict[str, Any],
    health_map: dict[str, dict[str, Any]],
    highlights: dict[str, Any],
    analysis: dict[str, Any],
    loki: dict[str, Any],
) -> str:
    generated = utc_now().isoformat()
    title = f"Sanctum AI Stress Report - {profile}"

    findings = analysis.get("findings", []) or []
    next_actions = analysis.get("next_actions", []) or []

    rows = []
    for key, state in health_map.items():
        rows.append(
            f"<tr><td>{html.escape(key)}</td><td>{html.escape(state.get('status', 'unknown'))}</td>"
            f"<td>{html.escape(state.get('error', ''))}</td></tr>"
        )

    finding_items = "".join(f"<li>{html.escape(str(item))}</li>" for item in findings) or "<li>None</li>"
    action_items = "".join(f"<li>{html.escape(str(item))}</li>" for item in next_actions) or "<li>None</li>"

    loki_lines = loki.get("entries", [])[:20]
    loki_block = "\n".join(html.escape(str(e.get("line", ""))) for e in loki_lines) or "No matching log lines."

    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --bg: #0b1020;
      --panel: #121a2f;
      --text: #ecf2ff;
      --muted: #9fb1d6;
      --good: #3ccf91;
      --warn: #ffb020;
      --bad: #ff5d6c;
      --edge: #293a66;
    }}
    body {{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background: radial-gradient(circle at top right, #16203d, var(--bg)); color: var(--text); }}
    main {{ max-width: 1120px; margin: 0 auto; padding: 28px 16px 40px; }}
    .grid {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }}
    .card {{ background: var(--panel); border: 1px solid var(--edge); border-radius: 12px; padding: 14px; }}
    h1, h2 {{ margin: 0 0 10px; }}
    p {{ margin: 6px 0; color: var(--muted); }}
    table {{ width:100%; border-collapse: collapse; }}
    td, th {{ border-bottom: 1px solid var(--edge); padding: 8px; text-align: left; font-size: 14px; }}
    pre {{ white-space: pre-wrap; background:#0a0f1e; border:1px solid var(--edge); padding:12px; border-radius:10px; max-height:320px; overflow:auto; }}
    .status-HEALTHY {{ color: var(--good); }}
    .status-WARNING {{ color: var(--warn); }}
    .status-CRITICAL {{ color: var(--bad); }}
  </style>
</head>
<body>
  <main>
    <h1>{html.escape(title)}</h1>
    <p>Generated: {html.escape(generated)} | Run dir: {html.escape(str(run_dir))}</p>

    <div class=\"grid\">
      <section class=\"card\"><h2>Status</h2><p class=\"status-{html.escape(str(analysis.get('status', 'WARNING')))}\"><strong>{html.escape(str(analysis.get('status', 'WARNING')))}</strong></p><p>{html.escape(str(analysis.get('summary', 'No summary provided')))}</p></section>
      <section class=\"card\"><h2>Run Metadata</h2><p>Profile: {html.escape(profile)}</p><p>Start: {html.escape(str(metadata.get('start_utc', 'N/A')))}</p><p>End: {html.escape(str(metadata.get('end_utc', 'N/A')))}</p></section>
      <section class=\"card\"><h2>k6 Highlights</h2><p>P95 latency (ms): {format_float(highlights.get('http_req_duration_p95_ms'), 2)}</p><p>HTTP failed rate: {format_float(highlights.get('http_req_failed_rate'), 5)}</p><p>Checks pass rate: {format_float(highlights.get('checks_pass_rate'), 5)}</p></section>
    </div>

    <section class=\"card\" style=\"margin-top:12px\"><h2>Data Source Health</h2><table><thead><tr><th>Source</th><th>Status</th><th>Error</th></tr></thead><tbody>{''.join(rows)}</tbody></table></section>

    <section class=\"grid\" style=\"margin-top:12px\">
      <div class=\"card\"><h2>Findings</h2><ul>{finding_items}</ul></div>
      <div class=\"card\"><h2>Next Actions</h2><ul>{action_items}</ul></div>
    </section>

    <section class=\"card\" style=\"margin-top:12px\"><h2>Loki Error/Warning Sample</h2><pre>{loki_block}</pre></section>
  </main>
</body>
</html>
"""

def render_report_markdown(
    run_dir: pathlib.Path,
    profile: str,
    metadata: dict[str, Any],
    health_map: dict[str, dict[str, Any]],
    highlights: dict[str, Any],
    analysis: dict[str, Any],
) -> str:
    findings = analysis.get("findings", []) or []
    bottlenecks = analysis.get("bottlenecks", []) or []
    causes = analysis.get("likely_causes", []) or []
    actions = analysis.get("next_actions", []) or []

    def section_items(items: list[Any]) -> str:
        if not items:
            return "- None"
        return "\n".join(f"- {item}" for item in items)

    health_lines = "\n".join(
        f"- `{name}`: **{state.get('status', 'unknown')}**"
        + (f" - {state.get('error')}" if state.get("error") else "")
        for name, state in health_map.items()
    )

    return f"""# Sanctum AI Stress Report ({profile})

- Generated: {utc_now().isoformat()}
- Run Dir: `{run_dir}`
- Status: **{analysis.get('status', 'WARNING')}**
- Summary: {analysis.get('summary', 'No summary provided')}

## k6 Highlights

- P95 latency (ms): {format_float(highlights.get('http_req_duration_p95_ms'), 2)}
- HTTP failed rate: {format_float(highlights.get('http_req_failed_rate'), 5)}
- Checks pass rate: {format_float(highlights.get('checks_pass_rate'), 5)}
- Iterations: {format_float(highlights.get('iterations'), 0)}
- Max VUs: {format_float(highlights.get('vus_max'), 0)}

## Run Window

- Profile: `{profile}`
- Start: `{metadata.get('start_utc', 'N/A')}`
- End: `{metadata.get('end_utc', 'N/A')}`

## Data Source Health

{health_lines}

## Findings
{section_items(findings)}

## Bottlenecks
{section_items(bottlenecks)}

## Likely Causes
{section_items(causes)}

## Next Actions
{section_items(actions)}
"""


def render_report_text(
    run_dir: pathlib.Path,
    profile: str,
    metadata: dict[str, Any],
    health_map: dict[str, dict[str, Any]],
    highlights: dict[str, Any],
    analysis: dict[str, Any],
) -> str:
    lines = [
        f"SANCTUM AI STRESS REPORT ({profile})",
        "=" * 48,
        f"Generated: {utc_now().isoformat()}",
        f"Run Dir: {run_dir}",
        f"Status: {analysis.get('status', 'WARNING')}",
        f"Summary: {analysis.get('summary', 'No summary provided')}",
        "",
        "k6 Highlights",
        f"- P95 latency (ms): {format_float(highlights.get('http_req_duration_p95_ms'), 2)}",
        f"- HTTP failed rate: {format_float(highlights.get('http_req_failed_rate'), 5)}",
        f"- Checks pass rate: {format_float(highlights.get('checks_pass_rate'), 5)}",
        f"- Iterations: {format_float(highlights.get('iterations'), 0)}",
        f"- Max VUs: {format_float(highlights.get('vus_max'), 0)}",
        "",
        "Run Window",
        f"- Profile: {profile}",
        f"- Start: {metadata.get('start_utc', 'N/A')}",
        f"- End: {metadata.get('end_utc', 'N/A')}",
        "",
        "Data Source Health",
    ]

    for name, state in health_map.items():
        err = state.get("error")
        line = f"- {name}: {state.get('status', 'unknown')}"
        if err:
            line += f" ({err})"
        lines.append(line)

    def append_list(title: str, items: list[Any]) -> None:
        lines.append("")
        lines.append(title)
        if not items:
            lines.append("- None")
            return
        for item in items:
            lines.append(f"- {item}")

    append_list("Findings", analysis.get("findings", []) or [])
    append_list("Bottlenecks", analysis.get("bottlenecks", []) or [])
    append_list("Likely Causes", analysis.get("likely_causes", []) or [])
    append_list("Next Actions", analysis.get("next_actions", []) or [])

    return "\n".join(lines) + "\n"


def build_index(root: pathlib.Path) -> pathlib.Path:
    root.mkdir(parents=True, exist_ok=True)
    entries = []
    for run_dir in list_run_dirs(root):
        report_html = run_dir / "report.html"
        if not report_html.exists():
            continue
        report_md = run_dir / "report.md"
        report_txt = run_dir / "report.txt"
        analysis = read_json_file(run_dir / "ai-analysis.json", {})
        status = analysis.get("status", "UNKNOWN")
        summary = analysis.get("summary", "")
        entries.append({
            "name": run_dir.name,
            "status": status,
            "summary": summary,
            "report_html": report_html,
            "report_md": report_md if report_md.exists() else None,
            "report_txt": report_txt if report_txt.exists() else None,
        })

    lines = [
        "<!doctype html>",
        "<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>",
        "<title>Sanctum Stress Report Index</title>",
        "<style>body{font-family:ui-sans-serif,system-ui;background:#0d1428;color:#e6edff;margin:0;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #2b3f74;padding:8px;text-align:left}a{color:#7dc4ff}</style>",
        "</head><body>",
        "<h1>Sanctum Stress Report Index</h1>",
        "<table><thead><tr><th>Run</th><th>Status</th><th>Summary</th><th>Reports</th></tr></thead><tbody>",
    ]
    for item in entries:
        rel_html = item["report_html"].relative_to(root)
        links = [f"<a href='{html.escape(str(rel_html))}'>html</a>"]
        if item["report_md"] is not None:
            rel_md = item["report_md"].relative_to(root)
            links.append(f"<a href='{html.escape(str(rel_md))}'>md</a>")
        if item["report_txt"] is not None:
            rel_txt = item["report_txt"].relative_to(root)
            links.append(f"<a href='{html.escape(str(rel_txt))}'>txt</a>")
        lines.append(
            f"<tr><td>{html.escape(item['name'])}</td><td>{html.escape(str(item['status']))}</td>"
            f"<td>{html.escape(str(item['summary']))}</td><td>{' | '.join(links)}</td></tr>"
        )
    lines.extend(["</tbody></table>", "</body></html>"])

    index_path = root / "index.html"
    index_path.write_text("\n".join(lines), encoding="utf-8")
    return index_path


def main() -> int:
    args = parse_args()
    artifact_root = pathlib.Path(args.artifact_dir)

    if args.build_index:
        index = build_index(artifact_root)
        print(f"Built index: {index}")
        return 0

    run_dir = resolve_run_dir(args)
    metadata = read_json_file(run_dir / "metadata.json", {})
    profile = args.profile or metadata.get("profile") or run_dir.name.split("-")[-1]
    start, end = parse_time_window(metadata)

    metadata.setdefault("profile", profile)
    metadata.setdefault("start_utc", start.isoformat())
    metadata.setdefault("end_utc", end.isoformat())

    summary, k6_health = read_k6_summary(run_dir)
    highlights = extract_k6_highlights(summary)

    prometheus_payload, prom_health = collect_prometheus(args.prom_url, start, end, args.timeout_seconds)
    loki_payload, loki_health = collect_loki(args.loki_url, start, end, args.timeout_seconds)

    write_json_file(run_dir / "metrics.json", prometheus_payload)
    write_json_file(run_dir / "logs.json", loki_payload)

    prompt = build_ollama_prompt(profile, metadata, highlights, prometheus_payload, loki_payload)
    model_analysis, ollama_health = call_ollama(args.ollama_url, args.ollama_model, prompt, args.timeout_seconds)

    health_map = {
        "k6": k6_health,
        "prometheus": prom_health,
        "loki": loki_health,
        "ollama": ollama_health,
    }

    analysis = model_analysis if model_analysis else default_ai_analysis(profile, health_map, highlights)
    analysis["data_source_health"] = health_map
    analysis["profile"] = profile
    analysis["run_dir"] = str(run_dir)
    analysis["generated_at"] = utc_now().isoformat()

    write_json_file(run_dir / "ai-analysis.json", analysis)

    report_html = render_report_html(
        run_dir=run_dir,
        profile=profile,
        metadata=metadata,
        health_map=health_map,
        highlights=highlights,
        analysis=analysis,
        loki=loki_payload,
    )
    (run_dir / "report.html").write_text(report_html, encoding="utf-8")
    (run_dir / "report.md").write_text(
        render_report_markdown(run_dir, profile, metadata, health_map, highlights, analysis),
        encoding="utf-8",
    )
    (run_dir / "report.txt").write_text(
        render_report_text(run_dir, profile, metadata, health_map, highlights, analysis),
        encoding="utf-8",
    )

    build_index(artifact_root)
    print(f"Report generated: {run_dir / 'report.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
