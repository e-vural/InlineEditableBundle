<?php

namespace Vrl\InlineEditableBundle\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

class Configuration implements ConfigurationInterface
{
    public function getConfigTreeBuilder(): TreeBuilder
    {
        $treeBuilder = new TreeBuilder('inline_editable');

        $treeBuilder->getRootNode()
            ->children()
                ->scalarNode('edit_mode')
                    ->defaultValue('inline')
                    ->info('Edit mode: "inline" (default) or "popup" (popover style)')
                    ->validate()
                        ->ifNotInArray(['inline', 'popup'])
                        ->thenInvalid('Invalid edit_mode. Must be "inline" or "popup".')
                    ->end()
                ->end()
                ->arrayNode('themes')
                    ->defaultValue([])
                    ->prototype('scalar')->end()
                    ->info('Custom template paths to override default bundle templates')
                    ->example(['inline_edit/custom_input.html.twig'])
                ->end()
            ->end()
        ;

        return $treeBuilder;
    }
}

