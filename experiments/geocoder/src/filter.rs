//! Which OSM objects are worth indexing for an outdoor-routes app: places
//! someone would name to find routes near, not addresses, streets or shops.

#[must_use]
pub fn keep(key: &str, value: &str) -> bool {
    match key {
        "place" => matches!(
            value,
            "country"
                | "state"
                | "region"
                | "province"
                | "district"
                | "county"
                | "municipality"
                | "city"
                | "borough"
                | "suburb"
                | "quarter"
                | "neighbourhood"
                | "town"
                | "village"
                | "hamlet"
                | "isolated_dwelling"
                | "locality"
                | "island"
                | "islet"
                | "archipelago"
                | "peninsula"
                | "sea"
                | "ocean"
        ),
        "boundary" => matches!(value, "administrative" | "national_park" | "protected_area"),
        "natural" => matches!(
            value,
            "peak"
                | "volcano"
                | "saddle"
                | "mountain_range"
                | "ridge"
                | "valley"
                | "water"
                | "bay"
                | "beach"
                | "cape"
                | "glacier"
                | "cliff"
                | "hot_spring"
                | "wood"
                | "gorge"
                | "plateau"
                | "hill"
                | "peninsula"
                | "strait"
                | "cave_entrance"
                | "arete"
                | "massif"
                | "fell"
                | "heath"
                | "moor"
                | "wetland"
                | "desert"
                | "dune"
                | "rock"
                | "spring"
        ),
        "water" => matches!(
            value,
            "lake" | "reservoir" | "lagoon" | "pond" | "river" | "oxbow"
        ),
        "waterway" => matches!(value, "waterfall" | "river" | "canal"),
        "mountain_pass" => true,
        "leisure" => matches!(value, "park" | "nature_reserve"),
        "landuse" => matches!(value, "forest"),
        "tourism" => matches!(
            value,
            "viewpoint"
                | "alpine_hut"
                | "wilderness_hut"
                | "camp_site"
                | "attraction"
                | "picnic_site"
        ),
        "railway" => matches!(value, "station" | "halt"),
        "highway" => matches!(value, "trailhead"),
        "route" => matches!(value, "hiking" | "foot" | "bicycle" | "mtb"),
        _ => false,
    }
}
