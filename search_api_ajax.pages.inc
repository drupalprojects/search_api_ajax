<?php

/**
 * Checks incoming AJAX requests for Search API pages paths
 */
function search_api_ajax_proxy($id, $keys = NULL) {
  $page = search_api_page_load((int)$id);
  if (!$page) {
    return MENU_NOT_FOUND;
  }

  $return = menu_execute_active_handler($page->path . '/' . $keys, FALSE);
  search_api_ajax_return_json($return);
}

/**
 * Checks incoming AJAX requests for Search API views paths
 */
function search_api_ajax_proxy_views($name, $display, $keys = NULL) {
  $view = views_get_view($name);
  if (!$view) {
    return MENU_NOT_FOUND;
  }

  $path = search_api_ajax_get_views_path($view->display[$display]->display_options['path'], 1);
  if ($keys) {
    $path = $path . '/' . $keys;
  }

  $return = menu_execute_active_handler($path, FALSE);
  search_api_ajax_return_json($return);
}

/**
 * Checks incoming AJAX requests for Taxonomy term paths
 */
function search_api_ajax_proxy_taxonomy() {
  $args = arg();
  $path = $args[1] . '/' . $args[2];
  $path = drupal_lookup_path('source', $path);
  $return = menu_execute_active_handler($path, FALSE);
  search_api_ajax_return_json($return);
}

/**
 * Performs a search request and returns page & block content html as JSON
 *
 * If the incoming request is not an AJAX request, user/bot is redirected
 * to the non-Ajax URL.
 *
 * @see search_api_ajax_modules()
 */
function search_api_ajax_return_json($return) {

  // check request source type: non-ajax is redirect back to non-ajax URL
  if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) != 'xmlhttprequest') {
    $params = drupal_get_query_parameters();
    $path = str_replace('search_api_ajax/', '', $_GET['q']);
    drupal_goto($path, array('query' => $params), 301);
    exit ;
  }

  if (is_int($return)) {
    switch ($return) {
      case MENU_NOT_FOUND :
        drupal_add_http_header('Status', '404 Not Found');
        break;
      case MENU_ACCESS_DENIED :
        drupal_add_http_header('Status', '403 Forbidden');
        break;
      case MENU_SITE_OFFLINE :
        drupal_add_http_header('Status', '503 Service unavailable');
        break;
    }
  }
  elseif (isset($return)) {
    global $theme;

    if (!isset($theme)) {
      init_theme();
    }

    // render JSON (views are already rendered)
    if (is_array($return)) {
      $return = drupal_render($return);
    }
    $json = array('regions' => array('search_api_ajax' => $return));

    // add new blocks
    $blocks = array();

    // Drupal blocks
    // @todo cache this?
    $regions = system_region_list($theme);
    foreach ($regions as $region_key => $region_name) {
      $settings['regions'][] = $region_key;
      $block_list = block_list($region_key);

      // remove inactive blocks (status=0)
      foreach ($block_list as $key => $block) {
        if ($block->status == 0) {
          unset($block_list[$key]);
        }
      }
      $blocks = array_merge(block_list($region_key), $blocks);
      if (module_exists('context')) {
        $blocks = array_merge(context_get_plugin('reaction', 'block')->block_list($region_key), $blocks);
      }
    }

    $modules = search_api_ajax_modules();
    foreach ($blocks as $block) {
      if (in_array($block->module, $modules)) {
        $rendered_block = _block_render_blocks(array($block));
        $rendered_block = _block_get_renderable_array($rendered_block);
        // Facetapi block names are strtolowered in html, so do same here.
        if (in_array($block->module, array(
          'facetapi',
          'facetapi_tagcloud'
        ))) {
          $block->delta = strtolower($block->delta);
        }
        $json['regions'][$block->region][$block->module . '_' . $block->delta] = drupal_render($rendered_block);

        // new blocks may have come into existence, we notify about them
        // otherwise they would never be displayed to the user
        // @see search_api_ajax.js
        $json['blocks'][$block->module . '_' . $block->delta] = str_replace('_', '-', '#block-' . $block->module . '-' . $block->delta);
      }
    }

    // merge all scopes and settings
    $javascript = drupal_add_js(NULL, NULL, NULL);
    $scopes = call_user_func_array('array_merge_recursive', $javascript);
    $json['settings'] = call_user_func_array('array_merge_recursive', array($scopes['data']));
    $json['debug'] = search_api_ajax_debug();

    drupal_add_http_header('Content-Type', 'application/json; charset=utf-8');
    print drupal_json_encode($json);
  }
}
