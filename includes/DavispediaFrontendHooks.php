<?php

use MediaWiki\Output\OutputPage;
use Skin;

class DavispediaFrontendHooks {
    public static function onBeforePageDisplay(
        OutputPage $out,
        Skin $skin
    ): void {
        $out->addModules( 'ext.davispedia.frontend' );
    }
}