<?php
namespace Espo\Custom\Hooks\Ferias;

use Espo\ORM\Entity;

class AutoCalcTransitados
{
    public static $order = 1;

    protected $entityManager;

    public function __construct(\Espo\Core\ORM\EntityManager $entityManager)
    {
        $this->entityManager = $entityManager;
    }

    public function beforeSave(Entity $entity, array $options): void
    {
        $ano = (int) $entity->get('ano');
        if (!$ano) {
            return;
        }

        // Set default prazo (30 de abril do ano corrente) if not defined
        if (!$entity->get('dataLimiteTransitados')) {
            $entity->set('dataLimiteTransitados', $ano . '-04-30');
        }

        // Auto-calculate diasTransitados from previous year (only if not manually overridden)
        if ($entity->isAttributeChanged('diasTransitados')) {
            return; // User changed it manually — respect that
        }

        $colaboradorId = $entity->get('colaboradorId');
        if (!$colaboradorId) {
            return;
        }

        $prevFerias = $this->entityManager->getRepository('Ferias')
            ->where([
                'colaboradorId' => $colaboradorId,
                'ano'           => $ano - 1,
            ])
            ->findOne();

        if (!$prevFerias) {
            return;
        }

        $prevTotal = (float) ($prevFerias->get('diasFeriasAno') ?? 0)
                   + (float) ($prevFerias->get('diasTransitados') ?? 0);

        $prevPeriods = $this->entityManager->getRepository('PeriodoFerias')
            ->where(['feriasId' => $prevFerias->getId(), 'deleted' => false])
            ->find();

        $prevUsado = 0;
        foreach ($prevPeriods as $p) {
            $prevUsado += (int) $p->get('diasmarcados');
        }

        $transitados = max(0, $prevTotal - $prevUsado);
        $entity->set('diasTransitados', $transitados);
    }
}
