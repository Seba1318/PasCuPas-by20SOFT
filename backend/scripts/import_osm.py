"""Descarcă o singură dată rețeaua pietonală din OpenStreetMap pentru DEMO_BBOX și o salvează
în graph_nodes și graph_edges.

Din folderul backend/ (osmnx e în grupul „data”, instalat doar pentru acest script):
    uv run --group data python -m scripts.import_osm
    uv run --group data python -m scripts.import_osm --replace   # reface graful

Atributele de accesibilitate (borduri, pante, suprafețe) le completează scripts/seed_fake.py.
Din OSM păstrăm doar ce e sigur: lungimea, numele străzii, treptele (highway=steps) și
trecerile de pietoni.
"""

import argparse
import sys

import osmnx as ox
from geoalchemy2 import WKTElement
from shapely.geometry import LineString, Point
from sqlalchemy import delete, func, insert, select, update

from app import config
from app.database import SessionLocal
from app.models import GraphEdge, GraphNode, Report, RouteBlock


def _tags(value) -> set[str]:
    """După simplificare, osmnx pune uneori o listă de valori pe același segment."""
    if isinstance(value, list):
        return {str(v) for v in value}
    return {str(value)} if isinstance(value, str) else set()


def download():
    print(f"Descarc rețeaua pietonală pentru {config.DEMO_BBOX} ...")
    # Implicit osmnx păstrează doar câteva etichete; „footway=crossing” marchează trecerile.
    ox.settings.useful_tags_way = [*ox.settings.useful_tags_way, "footway"]
    # bbox = (vest, sud, est, nord), aceeași ordine ca DEMO_BBOX
    graph = ox.graph_from_bbox(config.DEMO_BBOX, network_type="walk")
    # Pe trotuar se merge în ambele sensuri: un singur segment între două noduri.
    graph = ox.convert.to_undirected(graph)
    return ox.convert.graph_to_gdfs(graph)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--replace", action="store_true", help="șterge graful existent")
    args = parser.parse_args()

    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(GraphEdge))
        if existing and not args.replace:
            sys.exit(f"Graful are deja {existing} segmente. Folosiți --replace ca să îl refaceți.")

        nodes, edges = download()

        if existing:
            # Nu ștergem rapoartele: doar le dezlegăm de segmentele care dispar.
            db.execute(update(Report).values(edge_id=None))
            db.execute(delete(RouteBlock))
            db.execute(delete(GraphEdge))
            db.execute(delete(GraphNode))

        node_rows = [
            {"osm_id": int(osm_id), "geom": WKTElement(f"POINT({row.x} {row.y})", srid=4326)}
            for osm_id, row in nodes.iterrows()
        ]
        inserted = db.execute(
            insert(GraphNode).returning(GraphNode.id, GraphNode.osm_id), node_rows
        )
        node_id = {osm_id: our_id for our_id, osm_id in inserted}

        edge_rows = []
        for (u, v, _key), row in edges.iterrows():
            if u == v:  # bucle fără capăt nou, inutile pentru rutare
                continue
            line: LineString = row.geometry
            # Geometria trebuie să meargă de la from_node la to_node: semnul pantei depinde de asta.
            start = Point(nodes.loc[u].x, nodes.loc[u].y)
            if start.distance(Point(line.coords[0])) > start.distance(Point(line.coords[-1])):
                line = LineString(list(line.coords)[::-1])
            highway = _tags(row.get("highway"))
            names = sorted(_tags(row.get("name")))
            footway = _tags(row.get("footway"))
            edge_rows.append(
                {
                    "from_node": node_id[u],
                    "to_node": node_id[v],
                    "geom": WKTElement(line.wkt, srid=4326),
                    "length_m": float(row["length"]),
                    # Un segment simplificat poate traversa două străzi; păstrăm primul nume.
                    "name": names[0][:200] if names else None,
                    "has_stairs": "steps" in highway,
                    "is_crossing": "crossing" in footway or "crossing" in highway,
                }
            )
        db.execute(insert(GraphEdge), edge_rows)
        db.commit()

    print(f"Gata: {len(node_rows)} noduri și {len(edge_rows)} segmente.")
    print("Urmează: uv run python -m scripts.seed_fake")


if __name__ == "__main__":
    main()
