(function($) {
  Drupal.search_api_ajax = {};

  /**
   * We use the following jQuery BBQ hash states:
   *
   * #path: the facetapi_pretty path
   * #query: search ?query=<query>
   * #sort: sort field name
   * #order: sort order
   * #items_per_page: Views items_per_page
   * #page: Views paging
   */

  // Content settings
  var blocks = Drupal.settings.search_api_ajax.blocks;
  var content = Drupal.settings.search_api_ajax.content;
  var regions = Drupal.settings.search_api_ajax.regions;

  // Path setting
  var ajaxPath = Drupal.settings.search_api_ajax_path;

  // Visual settings
  var spinner = Drupal.settings.search_api_ajax.spinner;
  var target = Drupal.settings.search_api_ajax.scrolltarget;
  var fade = Drupal.settings.search_api_ajax.fade;
  var opacity = Drupal.settings.search_api_ajax.opacity;
  var speed = Drupal.settings.search_api_ajax.scrollspeed;

  // Re-fire AJAX when needed
  Drupal.behaviors.search_api_ajax = {
    attach: function(context, settings) {
      if (Drupal.search_api_ajax.readUrl(window.location.href) != '') {
        Drupal.search_api_ajax.initialize();
      }
    }
  };

  // Initialize listeners
  Drupal.search_api_ajax.initialize = function() {
    if (content) {
      Drupal.search_api_ajax.ajax(content);
    }
    if (blocks) {
      for (var block in blocks) {
        Drupal.search_api_ajax.ajax(blocks[block]);
      }
    }
  };

  // Read URL and remove Drupal base with RegExp
  Drupal.search_api_ajax.readUrl = function(url) {
    return url.replace(new RegExp('^.*' + Drupal.settings.basePath + ajaxPath + '/' + '?'), '');
  };

  // Translate clicked URL to BBQ state
  Drupal.search_api_ajax.urlToState = function(url) {
    state = Drupal.search_api_ajax.getUrlState(url);

    // Path is a special case
    urlPath = url.split('?');
    path = Drupal.search_api_ajax.readUrl(urlPath[0]);
    if (path != undefined && path != '') {
      state['path'] = path;
    }

    // Use merge_mode: 2 to completely replace state (removing empty fragments)
    $.bbq.pushState(state, 2);
  };

  // Get URL state
  Drupal.search_api_ajax.getUrlState = function(url) {
    var state = {};
    hashes = url.slice(url.indexOf('?') + 1).split('&');
    for ( i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      if (hash[1] != undefined && hash[1] != '') {
        state[hash[0]] = hash[1];
      }
    }
    return state;
  };

  // Post request to /search_api_ajax/path?query=
  Drupal.search_api_ajax.requestCallback = function(data) {

    // Visual effect: prepare for new data arrival
    if (content) {
      if (fade) {
        $(content + ':first').fadeTo('fast', opacity);
      }
      if (spinner) {
        $('#content').append('<div id="search-api-ajax-spinner"><img class="spinner" src="' + Drupal.settings.basePath + spinner + '" /></div>')
      }
    }

    // Scroll back to top, when top is out of view
    // Code taken from Views module
    if (target) {
      var offset = $(target).offset();
      var scrollTarget = target;
      while ($(scrollTarget).scrollTop() == 0 && $(scrollTarget).parent()) {
        scrollTarget = $(scrollTarget).parent()
      }
      if (offset.top - 10 < $(scrollTarget).scrollTop()) {
        $(scrollTarget).animate({
          scrollTop: (offset.top - 10)
        }, speed);
      }
    }

    path = '';
    if (data['path'] != undefined && data['path'] != '') {
      path = '/' + data['path'];
    }

    // Get AJAX, callback for returned JSON data
    $.get(Drupal.settings.basePath + 'search_api_ajax/' + ajaxPath + path, {
      query: data['query'],
      sort: data['sort'],
      order: data['order'],
      items_per_page: data['items_per_page'],
      page: data['page']
    }, Drupal.search_api_ajax.responseCallback, 'json');
  };

  // Process received JSON data
  Drupal.search_api_ajax.responseCallback = function(data) {

    // Visual effect: accept data arrival
    if (content) {
      if (fade) {
        $(content + ':first').fadeTo('fast', 1);
      }
      if (spinner) {
        $('#search-api-ajax-spinner').remove();
      }
    }

    for (var setting in data.settings) {
      Drupal.settings[setting] = data.settings[setting];
    }

    var list = [];

    // Add new blocks that have come into existence
    // @see search_api_ajax.pages.inc where we add this blocks variable
    if (data.blocks) {
      for (var new_block in data.blocks) {
        blocks[new_block] = data.blocks[new_block];
      }
    }

    // Schedule items for removal to avoid page jumpiness
    if (blocks) {
      for (var block in blocks) {
        list.push($(blocks[block]));
      }
    }

    // Output/append new data to frontend
    for (var region in data.regions) {
      if (region == 'search_api_ajax') {
        if (content) {
          $(content + ':first').html(data.regions[region]);
        }
      }
      else {
        for (var block in data.regions[region]) {
          if (regions[region] && blocks[block]) {
            $(regions[region]).append(data.regions[region][block]);
          }
        }
      }
    }

    // Remove blocks that were scheduled for removal
    for (var i = 0, l = list.length; i < l; i++) {
      list[i].remove();
    }

    // Re-fire Drupal attachment behaviors
    Drupal.attachBehaviors('body');
  };

  // Helper function to navigate on user actions
  Drupal.search_api_ajax.navigateUrl = function(url) {
    if (url !== undefined) {
      Drupal.search_api_ajax.urlToState(url)
    }
    return false;
  };

  // Helper function to navigate on new query
  Drupal.search_api_ajax.navigateQuery = function(query) {
    if (query !== undefined) {
      var state = {};
      state['query'] = query;
      $.bbq.pushState(state);
    }
    return false;
  };

  // Helper function to navigate on new range
  // Create Pretty Facet Path like: <field>/<from>/<to>
  Drupal.search_api_ajax.navigateRanges = function(field, from, to) {
    var state = {};
    state['path'] = field + '/[' + from + ' TO ' + to + ']';
    $.bbq.pushState(state);
    return false;
  };

  // Observe and react to user behavior
  // @see http://api.jquery.com/category/selectors/attribute-selectors/
  Drupal.search_api_ajax.ajax = function(selector) {

    // Observe facet and sorts links ^ starts with * contains
    // Check two paths: ^basePath/ajaxPath OR ^search_api_ajax/basePath/ajaxPath
    $(selector + ' a[href^="' + Drupal.settings.basePath + ajaxPath + '"], ' + selector + ' a[href^="' + Drupal.settings.basePath + 'search_api_ajax/' + ajaxPath + '"]').live('click', function() {
      return Drupal.search_api_ajax.navigateUrl($(this).attr('href'));
    });

    // Observe search keys forms (or views input forms, must be custom set)
    $(selector + ' form[action^="' + Drupal.settings.basePath + ajaxPath + '"], ' + selector + ' form[action^="' + Drupal.settings.basePath + 'search_api_ajax/' + ajaxPath + '"]').live('submit', function() {
      return Drupal.search_api_ajax.navigateQuery($(this).find('input[name*="keys"]').val());
    });

    // Observe facet range sliders
    $(selector + ' .search-api-ranges-widget form[action^="' + Drupal.settings.basePath + ajaxPath + '"], ' + selector + ' .search-api-ranges-widget form[action^="' + Drupal.settings.basePath + 'search_api_ajax/' + ajaxPath + '"]').live('submit', function() {
      rangeField = $(this).find('input[name="range-field"]').val();
      rangeFrom = $(this).find('input[name="range-from"]').val();
      rangeTo = $(this).find('input[name="range-to"]').val();
      return Drupal.search_api_ajax.navigateRanges(rangeField, rangeFrom, rangeTo);
    });
  };

  // Initialize
  Drupal.search_api_ajax.initialize();

  // If hash directly entered on page load (e.g. external link)
  data = $.bbq.getState();
  if (data != undefined && !$.isEmptyObject(data)) {
    Drupal.search_api_ajax.requestCallback(data);
  }

  // If hash changed through click
  $(window).bind('hashchange', function(e) {
    data = e.getState();
    Drupal.search_api_ajax.requestCallback(data);
  });
})(jQuery);
