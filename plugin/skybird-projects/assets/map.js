/**
 * Progressive enhancement for the per-service-area project map.
 *
 * The pin list is already in the HTML when this runs — see the note in
 * includes/map-shortcode.php. This script's whole job is to turn that list
 * into a map and hide it. If the script never runs, the API key is missing, or
 * Google Maps fails to load, the visitor still gets a working list of links to
 * every project in the area, and so does a crawler.
 *
 * Called by the Google Maps loader via its `callback` parameter.
 */
/* global google */
(function () {
	'use strict';

	function initMap(canvas) {
		var pins;

		try {
			pins = JSON.parse(canvas.getAttribute('data-pins') || '[]');
		} catch (e) {
			return; // Leave the list in place.
		}

		if (!pins.length) {
			return;
		}

		var bounds = new google.maps.LatLngBounds();
		var map = new google.maps.Map(canvas, {
			mapTypeControl: false,
			streetViewControl: false,
			fullscreenControl: false,

			// Zoom is capped. The pins are already offset by 0.2-0.3 miles
			// (docs/04-pin-precision-research.md), so letting a visitor zoom to
			// rooftop level would imply a precision the data does not have and
			// invite them to read a specific house off an approximate pin.
			maxZoom: 15
		});

		var info = new google.maps.InfoWindow();

		pins.forEach(function (pin) {
			var position = { lat: pin.lat, lng: pin.lng };
			var marker = new google.maps.Marker({
				position: position,
				map: map,
				title: pin.title
			});

			bounds.extend(position);

			marker.addListener('click', function () {
				var html = document.createElement('div');
				html.className = 'skybird-map__popup';

				if (pin.thumb) {
					var img = document.createElement('img');
					img.src = pin.thumb;
					img.alt = '';
					html.appendChild(img);
				}

				var link = document.createElement('a');
				link.href = pin.url;
				link.textContent = pin.title;
				html.appendChild(link);

				info.setContent(html);
				info.open(map, marker);
			});
		});

		map.fitBounds(bounds);

		// fitBounds on a single pin zooms all the way in, which defeats the
		// offset. Pull it back out once the map settles.
		google.maps.event.addListenerOnce(map, 'idle', function () {
			if (pins.length === 1 && map.getZoom() > 14) {
				map.setZoom(14);
			}
		});

		// The map is live, so the list has done its job for sighted users.
		// It stays in the DOM for crawlers and screen readers.
		var wrapper = canvas.closest('.skybird-map');
		if (wrapper) {
			wrapper.classList.add('skybird-map--enhanced');
		}
		canvas.removeAttribute('aria-hidden');
	}

	window.skybirdProjectsInitMaps = function () {
		var canvases = document.querySelectorAll('.skybird-map__canvas');

		Array.prototype.forEach.call(canvases, initMap);
	};
})();
