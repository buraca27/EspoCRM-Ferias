<?php

namespace Espo\Custom\Entities;

use Espo\Core\ORM\Entity;

class Ferias extends Entity
{
    public const ENTITY_TYPE = 'Ferias';

    public function getName(): string
    {
        $assignedUser = $this->get('assignedUser');
        $userId = $this->get('assignedUserId');

        if ($assignedUser) {
            return 'Férias: ' . $assignedUser;
        }

        if ($userId) {
            return 'Férias: User ' . $userId;
        }

        return $this->get('id') ?? 'Ferias';
    }
}
