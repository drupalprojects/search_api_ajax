(function($) {
  var history;
  Drupal.search_api_ajax = {};

  if(Drupal.settings.search_api_ajax) {
    var blocks = Drupal.settings.search_api_ajax.blocks;
    var content = Drupal.settings.search_api_ajax.content;
    var regions = Drupal.settings.search_api_ajax.regions;
    var spinner = Drupal.settings.search_api_ajax.spinner;
    var target = Drupal.settings.search_api_ajax.scrolltarget;
    var fade = Drupal.settings.search_api_ajax.fade;
    var opacity = Drupal.settings.search_api_ajax.opacity;
    var speed = Drupal.settings.search_api_ajax.scrollspeed;
    var ajaxPath = Drupal.settings.search_api_ajax.path;
    var isView = Drupal.settings.search_api_ajax.view;

    // initialize listeners
    Drupal.search_api_ajax.initialize = function() {
      if(content) {
        Drupal.search_api_ajax.ajax(content);
      }
      if(blocks) {
        for(var block in blocks) {
          Drupal.search_api_ajax.ajax(blocks[block]);
        }
      }
    };
    // extract url for ajax history
    Drupal.search_api_ajax.url_to_state = function(url) {
      return url.replace(new RegExp('^.*' + Drupal.settings.basePath + ajaxPath + '/' + '?'), '');
    };
    // prepare and perform ajax search request
    Drupal.search_api_ajax.request_callback = function(state) {
      if(content) {
        if(fade) {
          $(content + ':first').fadeTo('fast', opacity);
        }
        if(spinner) {
          $('#content').append('<div id="search-api-ajax-spinner"><img class="spinner" src="' + Drupal.settings.basePath + spinner + '" /></div>')
        }
      }

      // Scroll back to top, when top is out of view. Inspired by views module.
      if(target) {
        var offset = $(target).offset();
        var scrollTarget = target;
        while($(scrollTarget).scrollTop() == 0 && $(scrollTarget).parent()) {
          scrollTarget = $(scrollTarget).parent()
        }
        if(offset.top - 10 < $(scrollTarget).scrollTop()) {
          $(scrollTarget).animate({
            scrollTop : (offset.top - 10)
          }, speed);
        }
      }

      // post ajax, read json
      $.post(Drupal.settings.basePath + 'search_api_ajax/' + ajaxPath + '/' + state, {
        js : 1
      }, Drupal.search_api_ajax.response_callback, 'json');
    };
    // update search page with ajax, based on the json we read
    Drupal.search_api_ajax.response_callback = function(data) {
      if(content) {
        if(fade) {
          $(content + ':first').fadeTo('fast', 1);
        }
        if(spinner) {
          $('#search-api-ajax-spinner').remove();
        }
      }

      for(var setting in data.settings) {
        Drupal.settings[setting] = data.settings[setting];
      }

      var list = [];

      // we have to add the new blocks, that have come into existence
      // @see search_api_ajax.pages.inc where we add this blocks variable
      if(data.blocks) {
        for(var new_block in data.blocks) {
          blocks[new_block] = data.blocks[new_block];
        }
      }

      // schedule items for removal to reduce page jumpiness.
      if(blocks) {
        for(var block in blocks) {
          list.push($(blocks[block]));
        }
      }
      for(var region in data.regions) {
        if(region == 'search_api_ajax') {
          if(content) {
            $(content + ':first').html(data.regions[region]);
          }
        } else {
          for(var block in data.regions[region]) {
            if(regions[region] && blocks[block]) {
              $(regions[region]).append(data.regions[region][block]);
            }
          }
        }
      }

      for(var i = 0, l = list.length; i < l; i++) {
        list[i].remove();
      }

      // re-attach Drupal behaviors for whole document
      Drupal.attachBehaviors('body');
    };

    Drupal.search_api_ajax.navigate = function(url) {
      if(url !== undefined) {
        YUI().use('history', function(Y) {
          history.add({
            q : Drupal.search_api_ajax.url_to_state(url)
          });
        });
      }
      return false;
    };

    Drupal.search_api_ajax.ajax = function(selector) {

      // observe regular facet and sorts links
      $(selector + ' a[href*="' + Drupal.settings.basePath + ajaxPath + '"]').livequery('click', function() {
        return Drupal.search_api_ajax.navigate($(this).attr('href'));
      });
      // observe search keys forms (or views input forms, must be custom set)
      $(selector + ' form[action*="' + Drupal.settings.basePath + ajaxPath + '"]').livequery('submit', function() {
        return Drupal.search_api_ajax.navigate($(this).find('input[name*="keys"]').val());
      });
      // observe search refine options
      $(selector + ' li.search-refine-option input[type=checkbox]').livequery('change', function() {
        return Drupal.search_api_ajax.navigate($(this).val());
      });
      // observe facet range sliders
      $(selector + ' .search-api-ranges-widget form[action*="' + Drupal.settings.basePath + ajaxPath + '"]').livequery('submit', function() {
        var separator = '?';
        if($(this).find('input[name="range-ajax-target"]').val().indexOf("?") !== -1) {
          separator = '&';
        }

        return Drupal.search_api_ajax.navigate($(this).find('input[name="range-ajax-target"]').val() + separator + 'filter[' + $(this).find('input[name="range-field"]').val() + '][0]=' + '[' + $(this).find('input[name="range-from"]').val() + ' ' + $(this).find('input[name="range-to"]').val() + ']');
      });
    };
  }

  // we initiate YUI3's History extension
  YUI().use('history', function(Y) {

    // initialize
    history = new Y.HistoryHash();
    if(history.get('q')) {
      Drupal.search_api_ajax.request_callback(history.get('q'));
    }

    // listen to changes
    Y.on('history:change', function(e) {
      var changed = e.changed;
      if(changed.q) {
        Drupal.search_api_ajax.request_callback(history.get('q'));
      }
    });
  });

  Drupal.behaviors.search_api_ajax = {
    attach : function(context, settings) {

      // initialize livequery() event only if there is an active search
      // only needed for search api pages, not for views paths
      if(Drupal.search_api_ajax.url_to_state(window.location.href) != '' || isView === 1) {
        Drupal.search_api_ajax.initialize();
      }
    }
  };
})(jQuery);
