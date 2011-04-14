<?php

/**
 * Performs a search request and returns page & block content html as JSON
 *
 * If the incoming request is not an AJAX request, user/bot is redirected
 * to the non-Ajax URL.
 *
 * @see search_api_ajax_modules()
 */
function search_api_ajax_proxy($id, $keys = NULL) {
  $page = search_api_page_load((int) $id);
  if (!$page) {
    return MENU_NOT_FOUND;
  }

  $return = menu_execute_active_handler($page->path . '/' . $keys, FALSE);

  // check request source type: non-ajax is redirect back to non-ajax URL
  if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) != 'xmlhttprequest') {
    $params = drupal_get_query_parameters();
    $path = str_replace('search_api_ajax/', '', $_GET['q']);
    drupal_goto($path, array('query' => $params), 301);
    exit;
  }

  if (is_int($return)) {
    switch ($return) {
      case MENU_NOT_FOUND:
        drupal_set_header('HTTP/1.1 404 Not Found');
        break;
      case MENU_ACCESS_DENIED:
        drupal_set_header('HTTP/1.1 403 Forbidden');
        break;
      case MENU_SITE_OFFLINE:
        drupal_set_header('HTTP/1.1 503 Service unavailable');
        break;
    }
  }
  elseif (isset($return)) {
    global $theme;

    if (!isset($theme)) {
      init_theme();
    }

    $json = array('regions' => array('search_api_ajax' => drupal_render($return)));
    $regions = system_region_list($theme);
    $modules = search_api_ajax_modules();
    foreach (array_keys($regions) as $region) {
      if ($list = block_list($region)) {
        foreach ($list as $block) {
          if (in_array($block->module, $modules)) {
            $rendered_block = _block_render_blocks(array($block));
            $rendered_block = _block_get_renderable_array($rendered_block);
            $json['regions'][$region][$block->module .'_'. $block->delta] = drupal_render($rendered_block);

            // new blocks may have come into existence, we notify about them
            // otherwise they would never be displayed to the user
            // @see search_api_ajax.js
            $json['blocks'][$block->module . '_' . $block->delta] = str_replace('_', '-', '#block-' . $block->module . '-' . $block->delta);
          }
        }
      }
    }

    // merge all scopes and settings
    $javascript = drupal_add_js(NULL, NULL, NULL);
    $scopes = call_user_func_array('array_merge_recursive', $javascript);
    $json['settings'] = call_user_func_array('array_merge_recursive', array($scopes['data']));
    $json['debug'] = search_api_ajax_debug();

    header('Content-Type: application/json');
    print json_encode($json);
    exit;
  }
}
