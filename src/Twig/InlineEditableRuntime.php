<?php

namespace Vrl\InlineEditableBundle\Twig;

use Twig\Environment;
use Twig\Extension\RuntimeExtensionInterface;

class InlineEditableRuntime implements RuntimeExtensionInterface
{
    public function __construct(
        private Environment $twig,
        private array $themes = [],
        private string $editMode = 'inline'
    ) {

    }

    public function renderInput(array $config): string
    {
        return $this->renderField('input', $config, [$this, 'normalizeInputConfig']);
    }

    public function renderTextarea(array $config): string
    {
        return $this->renderField('textarea', $config, [$this, 'normalizeTextareaConfig']);
    }

    public function renderSelect(array $config): string
    {
        $normalizedConfig = $this->normalizeSelectConfig($config);
        $this->validateSelectConfig($normalizedConfig);
        
        return $this->renderField('select', $normalizedConfig);
    }

    /**
     * Ortak render metodu - kod tekrarını önler
     */
    private function renderField(string $type, array $config, ?callable $normalizer = null): string
    {
        if ($normalizer) {
            $config = $normalizer($config);
        }
        
        $template = $this->resolveTemplate($type);
        
        // Edit mode'u config'e ekle
        $config['editMode'] = $this->editMode;
        
        return $this->twig->render($template, [
            'config' => $config,
        ]);
    }

    /**
     * Select config validasyonu
     */
    private function validateSelectConfig(array $config): void
    {
        if (!isset($config['data']) || !is_array($config['data'])) {
            throw new \InvalidArgumentException('Select requires "data" array');
        }
        
        if (empty($config['choice_label_key'])) {
            throw new \InvalidArgumentException('Select requires "choice_label_key" parameter');
        }
        
        if (empty($config['data']) && !empty($config['selected_data'])) {
            throw new \InvalidArgumentException('Select "data" is empty but "selected_data" is not empty');
        }
        
        if (!empty($config['data'])) {
            foreach ($config['data'] as $item) {
                if (!is_array($item)) {
                    throw new \InvalidArgumentException('Select "data" items must be arrays');
                }
            }
        }
    }

    /**
     * Ortak base config'i normalize eder (tüm field type'lar için)
     */
    private function normalizeBaseConfig(array $config): array
    {
        $this->validateRequiredFields($config);

        // Base config default değerleri
        return array_merge([
            'value' => $config['value'] ?? '',
            'editFieldFormName' => $config['editFieldFormName'],
            'url' => $config['url'],
            'displayValue' => $config['displayValue'] ?? ($config['value'] ?? ''),
            'editable' => $config['editable'] ?? true,
            'attr' => $config['attr'] ?? [],
        ], $config);
    }

    /**
     * Required field'ları validate eder
     */
    private function validateRequiredFields(array $config): void
    {
        $requiredFields = ['editFieldFormName', 'url'];
        
        foreach ($requiredFields as $field) {
            if (!isset($config[$field])) {
                throw new \InvalidArgumentException(sprintf('%s is required', $field));
            }
        }
    }

    /**
     * Input config'i normalize eder (base + input-specific)
     */
    private function normalizeInputConfig(array $config): array
    {
        return $this->normalizeFieldConfig($config, 'input', [
            'htmlType' => $config['htmlType'] ?? 'text',
            'placeholder' => $config['placeholder'] ?? '',
        ]);
    }

    /**
     * Textarea config'i normalize eder (base + textarea-specific)
     */
    private function normalizeTextareaConfig(array $config): array
    {
        return $this->normalizeFieldConfig($config, 'textarea', [
            'placeholder' => $config['placeholder'] ?? '',
            'rows' => $config['rows'] ?? 2,
        ]);
    }

    /**
     * Select config'i normalize eder (base + select-specific)
     */
    private function normalizeSelectConfig(array $config): array
    {
        return $this->normalizeFieldConfig($config, 'select', [
            'data' => $config['data'] ?? [],
            'selected_data' => $config['selected_data'] ?? ($config['value'] ?? ''),
            'choice_label_key' => $config['choice_label_key'] ?? null,
            'choice_value_key' => $config['choice_value_key'] ?? 'id',
            'multiple' => $config['multiple'] ?? false,
            'placeholder' => $config['placeholder'] ?? '',
        ]);
    }

    /**
     * Field config'i normalize eder (base + field-specific defaults)
     */
    private function normalizeFieldConfig(array $config, string $type, array $fieldDefaults): array
    {
        $normalized = $this->normalizeBaseConfig($config);
        
        return array_merge($normalized, $fieldDefaults, [
            'type' => $type,
        ]);
    }

    /**
     * Template path'ini resolve eder (theme override desteği ile)
     */
    private function resolveTemplate(string $type): string
    {
        foreach ($this->themes as $themePath) {
            $basename = basename($themePath, '.html.twig');
            if (str_contains($basename, $type)) {
                return $themePath;
            }
        }
        
        return sprintf('@InlineEditable/inline_edit/%s.html.twig', $type);
    }
}

