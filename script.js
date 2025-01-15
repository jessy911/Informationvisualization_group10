d3.csv("data/artvis_dump_NEW.csv").then(function (data) {
    // Clean data and filter out invalid cities
    const validData = data.filter(d => d["e.city"] && d["e.city"].trim().length >= 3);
    console.log("Data with Valid Cities (3+ characters):", validData);

    // Get unique artist names
    const uniqueArtists = Array.from(new Set(validData.map(d => d["a.lastname"]))).sort();
    console.log("Unique Artists:", uniqueArtists);

    // Add a search input for artist selection
    d3.select("body")
        .append("input")
        .attr("type", "text")
        .attr("id", "artistSearch")
        .attr("placeholder", "Search for an artist...")
        .style("margin-bottom", "10px");

    // Add a dropdown for artist selection
    const dropdown = d3.select("body")
        .append("select")
        .attr("id", "artistDropdown")
        .style("margin-bottom", "20px");
    
    // Function to populate the dropdown with filtered artists
    function populateDropdown(filteredArtists) {
        dropdown.selectAll("option").remove(); // Clear existing options
        dropdown.selectAll("option")
            .data(filteredArtists)
            .enter()
            .append("option")
            .text(d => d)
            .attr("value", d => d);
    }
    
    // Initially populate the dropdown with all artists
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

    d3.select("#searchButton").on("click", function () {
        const currentArtist = dropdown.property("value");
        window.location.href = "index.html";
    });

    d3.select("body")
        .append("button")
        .attr("id", "searchButton")
        .text("Go Back to World Map")
        .style("padding", "0px 10px")
        .style("cursor", "pointer")
        .style("margin-left", "20px")
        .style("background-color", "skyblue")
        .on("click", function (event, d) {
            window.location.href = "index.html";
        });

    // Function to create a bar chart with tooltip
    function createBarChart(labels, values, title, xlabel, ylabel, containerId) {
        const width = 800;
        const height = 400;

        // Remove existing chart in the container
        d3.select(`#${containerId}`).select("svg").remove();

        // Append a div for the tooltip
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background", "lightgray")
            .style("padding", "5px")
            .style("border-radius", "5px")
            .style("font-size", "12px")
            .style("visibility", "hidden");

        const svg = d3.select(`#${containerId}`)
            .append("svg")
            .attr("width", width + 100)
            .attr("height", height + 100);

        const x = d3.scaleBand()
            .domain(labels)
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(values)])
            .nice()
            .range([height, 0]);

        const g = svg.append("g").attr("transform", "translate(50,50)");

        // X-axis
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(45)")
            .style("text-anchor", "start");

        // Y-axis
        g.append("g").call(d3.axisLeft(y));

        // Bars with tooltip functionality
        g.selectAll(".bar")
            .data(values)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", (d, i) => x(labels[i]))
            .attr("y", d => y(d))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d))
            .attr("fill", "skyblue")
            .on("mouseover", (event, d) => {
                tooltip.style("visibility", "visible").text(`Value: ${d}`);
            })
            .on("mousemove", (event) => {
                tooltip
                    .style("top", `${event.pageY - 10}px`)
                    .style("left", `${event.pageX + 10}px`);
            })
            .on("mouseout", () => {
                tooltip.style("visibility", "hidden");
            });

        // Chart title
        svg.append("text")
            .attr("x", width / 2 + 50)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(title);

        // Y-axis label
        svg.append("text")
            .attr("x", -height / 2 - 50)
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("transform", "rotate(-90)")
            .text(ylabel);

        // X-axis label
        svg.append("text")
            .attr("x", width / 2 + 50)
            .attr("y", height + 90)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text(xlabel);
    }

    // Function to update the charts for a selected artist
   function updateCharts(selectedArtist) {
       console.log("Selected Artist:", selectedArtist);

       // Filter data for the selected artist
       const artistData = validData.filter(d => d["a.lastname"] === selectedArtist);
       console.log(`Data for ${selectedArtist}:`, artistData);

       // Aggregate paintings by city for the selected artist
       const aggregateData = d3.rollups(
           artistData,
           v => d3.sum(v, d => +d["e.paintings"]),
           d => d["e.city"]
       ).map(([city, totalPaintings]) => ({ City: city, Total_Paintings: totalPaintings }));

       // Sort data by total number of paintings
       aggregateData.sort((a, b) => b.Total_Paintings - a.Total_Paintings);

       // Plot aggregated data for paintings by city
       createBarChart(
           aggregateData.map(d => d.City),
           aggregateData.map(d => d.Total_Paintings),
           `Number of Paintings by ${selectedArtist} in Each City`,
           "City",
           "Total Paintings",
           "chart1"
       );

       // Count shared exhibitions with other artists
       const exhibitionIDs = Array.from(new Set(artistData.map(d => d["e.id"])));
       const sharedExhibitions = validData
           .filter(d => exhibitionIDs.includes(d["e.id"]) && d["a.lastname"] !== selectedArtist)
           .map(d => d["a.lastname"]); // Extract only the last name


       const sharedCounts = d3.rollups(
           sharedExhibitions,
           v => v.length,
           d => d
       ).map(([surname, frequency]) => ({ Artist: surname, Frequency: frequency }));

       // Sort shared exhibitions by frequency
       sharedCounts.sort((a, b) => b.Frequency - a.Frequency);

       // Conditional: Show top 10 artists if more than 10, otherwise show all
       const topArtists = sharedCounts.length > 10 ? sharedCounts.slice(0, 10) : sharedCounts;

       // Plot shared exhibitions for the top artists
       createBarChart(
           topArtists.map(d => d.Artist),
           topArtists.map(d => d.Frequency),
           `Artists Who Exhibited with ${selectedArtist}`,
           "Artist (Surname)",
           "Number of Shared Exhibitions",
           "chart2"
       );
   }


    // Add containers for the two charts
    d3.select("body").append("div").attr("id", "chart1");
    d3.select("body").append("div").attr("id", "chart2");

    // Initialize the charts with the first artist
    updateCharts(uniqueArtists[0]);

    // Add event listener for dropdown change
    dropdown.on("change", function () {
        const selectedArtist = d3.select(this).property("value");
        updateCharts(selectedArtist);
    });
});




