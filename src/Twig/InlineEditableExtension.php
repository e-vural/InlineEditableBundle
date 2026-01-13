<?php

namespace Vrl\InlineEditableBundle\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class InlineEditableExtension extends AbstractExtension
{
    public function getFunctions(): array
    {
        return [
            new TwigFunction('inline_edit_input', [InlineEditableRuntime::class, 'renderInput'], [
                'is_safe' => ['html'],
            ]),
            new TwigFunction('inline_edit_textarea', [InlineEditableRuntime::class, 'renderTextarea'], [
                'is_safe' => ['html'],
            ]),
            new TwigFunction('inline_edit_select', [InlineEditableRuntime::class, 'renderSelect'], [
                'is_safe' => ['html'],
            ]),
        ];
    }


}

