<?php

namespace Vrl\InlineEditableBundle;

use Symfony\Component\DependencyInjection\Extension\ExtensionInterface;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;
use Vrl\InlineEditableBundle\DependencyInjection\InlineEditableExtension;

class InlineEditableBundle extends AbstractBundle
{
    public function getPath(): string
    {
        return \dirname(__DIR__);
    }

    public function getContainerExtension(): ?ExtensionInterface
    {
        return $this->extension ??= new InlineEditableExtension();
    }
}

