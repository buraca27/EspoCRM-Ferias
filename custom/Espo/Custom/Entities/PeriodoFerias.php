<?php

namespace Espo\Custom\Entities;

use Espo\Core\ORM\Entity;

class PeriodoFerias extends Entity
{
    public const ENTITY_TYPE = 'PeriodoFerias';

    public function getName(): string
    {
        $dateStart = $this->get('dateStart');
        $dateEnd = $this->get('dateEnd');

        if ($dateStart && $dateEnd) {
            return substr($dateStart, 0, 10) . ' a ' . substr($dateEnd, 0, 10);
        }

        return $this->get('id') ?? 'Período';
    }
}
