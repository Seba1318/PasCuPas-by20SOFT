"""Pașii traseului și avertismentele (planul 20SOFT · Navigarea în timp real).

Unde unghiul dintre două segmente se schimbă cu peste 30°, apare o indicație de viraj.
Trecerile de pietoni au pasul lor („Traversează strada”), ca utilizatorul să știe unde.
"""

import math

from app.routing.astar import Path, haversine_m
from app.routing.cost import has_mobility_rules
from app.routing.graph import Coord, Graph

TURN_DEG = 30
COMPASS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-vest", "vest", "nord-vest"]


def bearing(a: Coord, b: Coord) -> float:
    """Direcția de la a la b, în grade: 0 = nord, 90 = est (în sensul acelor de ceasornic)."""
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    y = math.sin(lon2 - lon1) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def turn_text(delta: float) -> str:
    """delta = schimbarea de direcție, între −180 și 180; pozitiv = spre dreapta."""
    side = "dreapta" if delta > 0 else "stânga"
    size = abs(delta)
    if size < 60:
        return f"Virează ușor la {side}"
    if size < 150:
        return f"Virează la {side}"
    return "Întoarce-te"


def _first_last_bearing(coords: list[Coord]) -> tuple[float, float]:
    points = [c for i, c in enumerate(coords) if i == 0 or c != coords[i - 1]]
    if len(points) < 2:
        return 0.0, 0.0
    return bearing(points[0], points[1]), bearing(points[-2], points[-1])


def route_coords(graph: Graph, path: Path) -> list[Coord]:
    coords: list[Coord] = [graph.nodes[path.nodes[0]]]
    for edge_id, direction in path.steps:
        coords.extend(graph.edges[edge_id].coords_in(direction)[1:])
    return coords


MIN_TURN_STEP_M = 12


def compact(steps: list[dict]) -> list[dict]:
    """Pașii care nu ajută pe stradă dispar: un viraj urmat de mai puțin de 12 m (un colț de
    trotuar din OSM) intră în pasul dinainte, iar traversările la rând (o intersecție cu
    insulă la mijloc) devin una, cu semaforul sonor păstrat dacă există."""
    result = [steps[0]]
    for step in steps[1:]:
        previous = result[-1]
        both_crossings = step["instruction"].startswith("Traversează") and previous[
            "instruction"
        ].startswith("Traversează")
        tiny_turn = (
            step["instruction"].startswith("Virează") and step["distance_m"] < MIN_TURN_STEP_M
        )
        if both_crossings:
            if "semaforul sonor" in step["instruction"]:
                previous["instruction"] = step["instruction"]
            previous["distance_m"] += step["distance_m"]
        elif tiny_turn:
            previous["distance_m"] += step["distance_m"]
        else:
            result.append(step)
    return result


def build_steps(graph: Graph, path: Path, start: Coord, end: Coord) -> list[dict]:
    """Pașii afișați și rostiți: instrucțiunea, distanța până la pasul următor, locul."""
    if not path.steps:
        return [{"instruction": "Ai ajuns la destinație", "distance_m": 0, "coord": list(end)}]

    first = graph.edges[path.steps[0][0]].coords_in(path.steps[0][1])
    heading, _ = _first_last_bearing(first)
    first_name = graph.edges[path.steps[0][0]].name
    steps = [
        {
            "instruction": f"Pornește spre {COMPASS[round(heading / 45) % 8]}"
            + (f" pe {first_name}" if first_name else ""),
            "coord": list(start),
            "distance_m": haversine_m(start, graph.nodes[path.nodes[0]]),
        }
    ]
    previous_out = previous_name = None
    for edge_id, direction in path.steps:
        edge = graph.edges[edge_id]
        coords = edge.coords_in(direction)
        into, out = _first_last_bearing(coords)
        text = None
        if edge.is_crossing:
            text = "Traversează strada" + (" la semaforul sonor" if edge.has_audio_signal else "")
        elif previous_out is not None:
            delta = (into - previous_out + 540) % 360 - 180
            if abs(delta) > TURN_DEG:
                text = turn_text(delta) + (f" pe {edge.name}" if edge.name else "")
            elif edge.name and edge.name != previous_name and previous_name is not None:
                text = f"Continuă pe {edge.name}"
        if text and text != steps[-1]["instruction"]:
            steps.append({"instruction": text, "coord": list(coords[0]), "distance_m": 0.0})
        steps[-1]["distance_m"] += edge.length_m
        previous_out = out
        previous_name = edge.name or previous_name

    steps[-1]["distance_m"] += haversine_m(graph.nodes[path.nodes[-1]], end)
    steps = compact(steps)
    steps.append({"instruction": "Ai ajuns la destinație", "distance_m": 0, "coord": list(end)})
    for step in steps:
        step["distance_m"] = round(step["distance_m"])
    return steps


def _midpoint(coords: list[Coord]) -> list[float]:
    return list(coords[len(coords) // 2])


def ro_number(value: float) -> str:
    """4.2 → „4,2”: în română zecimalele se scriu cu virgulă."""
    return f"{value:g}".replace(".", ",")


MIN_SLOPE_LENGTH_M = 15  # pantele mai scurte nu merită un avertisment
MAX_PER_TYPE = 3


def build_warnings(graph: Graph, path: Path, profile) -> list[dict]:
    """Ce e permis de profil, dar merită știut: cele mai abrupte pante, bordurile mai înalte
    de jumătate din maxim și pauzele recomandate. Cel mult 3 de fiecare fel, ca ecranul să
    rămână lizibil."""
    max_incline = getattr(profile, "max_incline_pct", None)
    incline_limit = max_incline / 2 if max_incline else 5
    max_kerb = getattr(profile, "max_kerb_cm", None)
    kerb_limit = max_kerb / 2 if max_kerb else 3
    slopes, kerbs, rests = [], [], []

    if has_mobility_rules(profile):
        for edge_id, direction in path.steps:
            edge = graph.edges[edge_id]
            where = _midpoint(edge.coords_in(direction))
            slope = abs(edge.incline_pct)
            if slope > incline_limit and edge.length_m >= MIN_SLOPE_LENGTH_M:
                kind = "Urcare" if edge.incline_pct * direction > 0 else "Coborâre"
                text = f"{kind} cu pantă de {ro_number(slope)} % pe {edge.length_m:.0f} m"
                slopes.append((slope, {"type": "incline", "text": text, "coord": where}))
            if edge.kerb_height_cm > kerb_limit:
                text = f"Bordură de {ro_number(edge.kerb_height_cm)} cm la trecere"
                kerbs.append((edge.kerb_height_cm, {"type": "kerb", "text": text, "coord": where}))

    rest_every = getattr(profile, "needs_rest_every_m", None)
    if rest_every:
        walked = total = 0.0
        for edge_id, direction in path.steps:
            edge = graph.edges[edge_id]
            walked += edge.length_m
            total += edge.length_m
            if edge.has_bench:
                walked = 0.0
            elif walked > rest_every:
                text = f"Pauză recomandată după {total:.0f} m: nu e nicio bancă pe {rest_every} m"
                coord = list(edge.coords_in(direction)[0])
                rests.append({"type": "rest", "text": text, "coord": coord})
                walked = 0.0

    def worst(items):  # cele mai mari valori primele
        return [warning for _, warning in sorted(items, key=lambda item: -item[0])[:MAX_PER_TYPE]]

    return worst(slopes) + worst(kerbs) + rests[:MAX_PER_TYPE]
