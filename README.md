# Mapping the Philippines

**Mapping the Philippines** is a project that aims to visualize various aspects of the Philippines using geographic data. It is structured to support multiple sub-projects, each with a specific theme or dataset.

## 🌐 Sub-Project: Mapping the 2025 Elections

The first sub-project focuses on visualizing the **2025 Philippine Elections** by mapping the winning candidates at the **barangay level** across the country.

<!-- ![screenshot](https://cjdeclaro.github.io/mapping-the-ph/preview.png) -->

### 🔧 Tech Stack
- **[Leaflet.js](https://leafletjs.com/)** for interactive maps  
- **GeoJSON** data for Philippine administrative boundaries  
- **PHP-based web scraping** for election data  
- **JSON APIs** to serve results to the frontend  
- **Local caching** to improve performance (note: this uses disk space)

### 📍 Data Sources
- **GeoJSON Maps**
  - [macoymejia/geojsonph](https://github.com/macoymejia/geojsonph/)
  - [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps)

- **Election Results**
  - Scraped from the [COMELEC 2025 Transparency Server](https://2025electionresults.comelec.gov.ph/dashboard)
  - Web scraping logic adapted from [ianalis/scraper2025](https://github.com/ianalis/scraper2025)
  - PHP-based scraping implementation and full JSON dataset available at:  
    👉 [cjdeclaro/2025-election-results-web-scrape](https://github.com/cjdeclaro/2025-election-results-web-scrape)

### 📊 How it Works
- This project pulls JSON data from the [scraping repository](https://github.com/cjdeclaro/2025-election-results-web-scrape) via API fetch.
- The map displays the winning candidate per barangay, color-coded for easy reference.

### 🚨 Disclaimers
- **Not Official**: This project is for visualization and educational purposes only. The data may be incomplete, outdated, or contain inaccuracies due to scraping and technical limitations.
- **Resource Intensive**: Rendering the full map (especially at the barangay level) may be demanding on your computer.
- **Storage Note**: The project uses local caching, which will consume disk space for faster loading.

### ⚠️ Known Issues
- Some barangay-level data might be missing or incorrectly rendered due to incomplete election data.
- Overseas precincts may appear outside the map bounds or be difficult to view.
- Performance may slow down on low-end devices or when zooming/panning rapidly.
- The map currently does not support mobile-friendly interaction optimizations.
- Rendering large GeoJSON files can cause lag or crashes in certain browsers.

### 🔗 GitHub Pages
You can view the project here:  
➡️ [https://cjdeclaro.github.io/mapping-the-ph/](https://cjdeclaro.github.io/mapping-the-ph/)

---

### 📌 About This Project

A personal project by **Christopher Jay De Claro**  
Professor, Polytechnic University of the Philippines – Sto. Tomas  
**For the people.**

**Contact Me**  
📧 cjdeclaro16@gmail.com  
📷 [Instagram](https://instagram.com/cjdeclaro)  
🔗 [LinkedIn](https://linkedin.com/in/cjdeclaro)

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).  
You are free to use, modify, and distribute this code with proper attribution.
