<?php

namespace Vrl\InlineEditableBundle\DependencyInjection;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;

class InlineEditableExtension extends Extension implements PrependExtensionInterface
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $configuration = new Configuration();
        $config = $this->processConfiguration($configuration, $configs);

        // Edit mode'u parameter olarak container'a ekle
        $container->setParameter('inline_editable.edit_mode', $config['edit_mode'] ?? 'inline');
        
        // Themes'i parameter olarak container'a ekle
        $container->setParameter('inline_editable.themes', $config['themes'] ?? []);

        $loader = new YamlFileLoader($container, new FileLocator(__DIR__.'/../../config'));
        $loader->load('services.yaml');
    }

    public function prepend(ContainerBuilder $container): void
    {
        // Bundle'ın asset path'ini asset mapper'a otomatik ekle
        $container->prependExtensionConfig('framework', [
            'asset_mapper' => [
                'paths' => [
                    'vendor/vrl/inline-editable-bundle/assets',
                ],
            ],
        ]);
    }

    public function getAlias(): string
    {
        return 'inline_editable';
    }
}

