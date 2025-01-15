Promise.all([ 
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("data/artvis_dump_NEW.csv")
]).then(([worldmap, data]) => {
    // Process data
    const validData = data.filter(d => d["e.city"] && d["e.city"].trim().length >= 3);
    const uniqueArtists = Array.from(new Set(validData.map(d => d["a.lastname"]))).sort();

    console.log("Data with Valid Cities (3+ characters):", validData);
    console.log("Unique Artists:", uniqueArtists);

    // Populate dropdown with artists
    const dropdown = d3.select("#artistDropdown");
    function populateDropdown(filteredArtists) {
        dropdown.selectAll("option").remove();
        dropdown.selectAll("option")
            .data(filteredArtists)
            .enter()
            .append("option")
            .text(d => d)
            .attr("value", d => d);
    }

    populateDropdown(uniqueArtists);

    // Add event listener for search input
    d3.select("#artistSearch").on("input", function () {
        const searchTerm = d3.select(this).property("value").toLowerCase();
        const filteredArtists = uniqueArtists.filter(artist =>
            artist.toLowerCase().includes(searchTerm)
        );
        populateDropdown(filteredArtists);

        // Auto-select the first artist in the filtered list
        if (filteredArtists.length > 0) {
            dropdown.property("value", filteredArtists[0]);
            updateCharts(filteredArtists[0]);
        }
    });

    // Save artist name when pressing Enter in the search bar
    d3.select("#artistSearch").on("keydown", function (event) {
        if (event.key === "Enter") {
            const searchTerm = d3.select(this).property("value").toLowerCase();
            let matchedArtist = uniqueArtists.find(artist =>
                artist.toLowerCase() === searchTerm
            );

            if (!matchedArtist) {
                const dropdownOptions = dropdown.selectAll("option").data();
                if (dropdownOptions.length > 0) {
                    matchedArtist = dropdownOptions[0];
                }
            }

            if (matchedArtist) {
                updateMap(matchedArtist);
                dropdown.property("value", matchedArtist);
            }
        }
    });

    // Function to create map
    function createMap(aggregateData) {
        // Clear existing map
        d3.select("#mapContainer").selectAll("svg").remove();

        // Map dimensions
        const width = 1000;
        const height = 750;

        // Create the SVG for the map
        const svg = d3.select("#mapContainer")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const mapGroup = svg.append("g");

        const projection = d3.geoMercator()
            .center([0, 20]) // Center of the map
            .scale(130)
            .translate([width/2, height/2]);

        const path = d3.geoPath().projection(projection);

        mapGroup.append("g")
            .selectAll("path")
            .data(worldmap.features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", "#68B95E")
            .attr("stroke", "#ffffff")
            .style("stroke-width", 0.3)
            .style("opacity", 0.5);

        // Group for the circles
        const circlesGroup = mapGroup.append("g")
            .selectAll("circle")
            .data(aggregateData)
            .enter()
            .append("circle")
            .attr("cx", d => {
                const coords = projection([d.Longitude, d.Latitude]);
                return coords ? coords[0] : 0; // Handle invalid projections
            })
            .attr("cy", d => {
                const coords = projection([d.Longitude, d.Latitude]);
                return coords ? coords[1] : 0; // Handle invalid projections
            })
            .attr("r", d => Math.sqrt(d.TotalExhibitions)*7) // Initial radius
            .style("fill", "skyblue")
            .attr("opacity", 0.8)
            .attr("stroke", "black")
            .attr("stroke-width", 0.3)
            .on("click", function (event, d) {
                const currentArtist = dropdown.property("value");
                window.location.href = "visual.html";
            })
            .append("title") // Tooltip for counts
            .text(d => `${d.Country}, ${d.City}: ${d.TotalExhibitions} exhibitions. \nclick for futher information on artist`);

        // Get bounds of the world map (edges of the map)
        const bounds = path.bounds(worldmap);
        const topLeft = bounds[0];
        const bottomRight = bounds[1];

        // Define the translateExtent for zoom and pan limits
        const translateExtent = [
            [-(bottomRight[0] - width), -(bottomRight[1] - height)], // top-left bound
            [width - topLeft[0], height - topLeft[1]] 
        ];

        // Define the zoom behavior with scale and translate limits
        const zoom = d3.zoom()
            .scaleExtent([1, 8]) // Limit zoom levels
            .translateExtent(translateExtent)
            .on("zoom", function (event) {
                const transform = event.transform;
                // Apply zoom transformation to the map group
                mapGroup.attr("transform", transform);

                // Adjust circle size based on zoom level
                const currentZoom = transform.k; // Current zoom level
                mapGroup.selectAll("circle")
                    .attr("r", d => (Math.sqrt(d.TotalExhibitions) * 5) / currentZoom); // Scale radius
            });

        // Apply zoom behavior with limits
        svg.call(zoom);
    }

    // Function to update the map for the selected artist
    function updateMap(selectedArtist) {
        console.log("Selected Artist:", selectedArtist);

        // Filter data for the selected artist
        const artistData = validData.filter(d => d["a.lastname"] === selectedArtist);
        console.log(`Data for ${selectedArtist}:`, artistData);

        // Aggregate data: count occurrences and get coordinates
        const aggregateData = d3.rollups(
            artistData,
            v => ({
                count: v.length, // Count of exhibitions
                lon: parseFloat(v[0]["e.longitude"]),
                lat: parseFloat(v[0]["e.latitude"]),
                country: (v[0]["e.country"]),
            }),
            d => d["e.city"] // Group by city
        ).map(([city, { count, lon, lat, country }]) => ({
            City: city,
            TotalExhibitions: count,
            Longitude: lon,
            Latitude: lat,
            Country: country
        }));

        console.log("Aggregate Data:", aggregateData);

        // Draw the map with the updated data
        createMap(aggregateData);
    }

    // Initialize with the first artist
    if (uniqueArtists.length > 0) {
        updateMap(uniqueArtists[0]);
    }

    // Add event listener for dropdown change
    dropdown.on("change", function () {
        const selectedArtist = d3.select(this).property("value");
        updateMap(selectedArtist);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});