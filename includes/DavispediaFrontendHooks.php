<?php

use MediaWiki\Output\OutputPage;
use MediaWiki\Skin\Skin;

class DavispediaFrontendHooks {
    public static function onBeforePageDisplay(
        OutputPage $out,
        Skin $skin
    ): void {
        $out->addModules( 'ext.davispedia.frontend' );

        // React and the calendar UI are intentionally loaded only on the
        // Cowlender special page, rather than on every Davispedia article.
        if ( $out->getTitle()->isSpecial( 'Cowlender' ) ) {
            $out->addModules( 'ext.davispedia.cowlender' );
        }
    }
}
