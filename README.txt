Ajaxify Search API pages.

1. INSTALLATION AND CONFIGURATION

This Ajax module does not understand your theme CSS id's by default. You must
implement a custom module hook to let it know about your theme.
 
For example, create and enable a custom mymodule.module containing this code:

<?php
/**
 * Implements hook_search_api_ajax_settings().
 */
function mymodule_search_api_ajax_settings() {
  $settings = array(
  
    // CSS id for main content (search results html)
    // format: content => CSS id
    'content' => '#content .content',
    
    // CSS id's for regions containing search blocks
    // check your region names in mytheme.info
    // format: region_name => CSS id
    'regions' => array(
      'sidebar_first' => '#sidebar-first',
      'sidebar_second' => '#sidebar-second',
    ),
    
    // OPTIONAL: if you want to provide an AJAX spinner
    // this paht is for a default spinner path provided with this module
    // @note: see the search_api_ajax.css
    'spinner' => drupal_get_path('module', 'search_api_ajax') .'/spinner.gif',
    
    // OPTIONAL: if you want to use scroll-to-top functionality when paging
    // scroll target div
    'scrolltarget' => '#main-content',
    'scrollspeed' => 1000,
    
    // OPTIONAL: if you want to fade search results when Ajaxing
    // please set to 1 for TRUE
    'fade' => 1,
    'opacity' => 0.3,    
  );
  
  return $settings;
}

2. OPTIONAL: customize YUI3 jquery

If you want to use your custom YUI3 logic, you can override:
theme_search_api_ajax_js()
See search_api_ajax.module
