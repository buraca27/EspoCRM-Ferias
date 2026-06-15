<?php
namespace Espo\Custom\Hooks\PeriodoFerias;

use Espo\ORM\Entity;
use Espo\Core\Exceptions\Error;

class SyncDateFields
{
    public static $order = 1;

    protected $entityManager;

    public function __construct(\Espo\Core\ORM\EntityManager $entityManager)
    {
        $this->entityManager = $entityManager;
    }

    public function beforeSave(Entity $entity, array $options): void
    {
        $dateStart = $entity->get('dateStart');
        $dateEnd   = $entity->get('dateEnd');

        // Determine the effective start date for validation
        $startDateStr = $entity->get('dateStartDate')
            ?: ($dateStart ? substr((string) $dateStart, 0, 10) : null);

        if ($entity->isNew() && $startDateStr) {
            $today = (new \DateTime('today'))->format('Y-m-d');
            if ($startDateStr < $today) {
                throw new Error('Nao e possivel marcar ferias no passado.');
            }
        }

        // Datetime → date-only sync
        if ($dateStart) {
            $entity->set('dateStartDate', substr((string) $dateStart, 0, 10));
        }
        if ($dateEnd) {
            $entity->set('dateEndDate', substr((string) $dateEnd, 0, 10));
        }

        // Date-only → datetime sync (use noon to avoid timezone boundary issues)
        if (!$dateStart && $entity->get('dateStartDate')) {
            $entity->set('dateStart', $entity->get('dateStartDate') . ' 12:00:00');
        }
        if (!$dateEnd && $entity->get('dateEndDate')) {
            $entity->set('dateEnd', $entity->get('dateEndDate') . ' 12:00:00');
        }

        // Auto-calculate diasmarcados
        $startStr = $entity->get('dateStartDate');
        $endStr   = $entity->get('dateEndDate');

        if ($startStr && $endStr) {
            $start = new \DateTime($startStr);
            $end   = new \DateTime($endStr);
            if ($end >= $start) {
                $entity->set('diasmarcados', (int) $start->diff($end)->days + 1);
            }
        }

        // Auto-suggest tipoDias for new records (if not explicitly set by user)
        if ($entity->isNew() && !$entity->isAttributeChanged('tipoDias')) {
            $feriasId = $entity->get('feriasId');
            if ($feriasId) {
                $ferias = $this->entityManager->getRepository('Ferias')->getById($feriasId);
                if ($ferias) {
                    $diasTransitados       = (float) ($ferias->get('diasTransitados') ?? 0);
                    $diasTransitadosUsados = (float) ($ferias->get('diasTransitadosUsados') ?? 0);
                    $dataLimite            = $ferias->get('dataLimiteTransitados');
                    $transitadosRestantes  = $diasTransitados - $diasTransitadosUsados;

                    if ($transitadosRestantes > 0 && $dataLimite && $startStr && $startStr <= $dataLimite) {
                        $entity->set('tipoDias', 'Ano Anterior');
                    } else {
                        $entity->set('tipoDias', 'Ano Atual');
                    }
                }
            }
        }
    }

    public function afterSave(Entity $entity, array $options): void
    {
        $feriasId = $entity->get('feriasId');
        if (!$feriasId) {
            return;
        }

        $ferias = $this->entityManager->getRepository('Ferias')->getById($feriasId);
        if (!$ferias) {
            return;
        }

        // Recalculate per-bucket usage
        $periods = $this->entityManager->getRepository('PeriodoFerias')
            ->where(['feriasId' => $feriasId, 'deleted' => false])
            ->find();

        $diasAnoAtual    = 0;
        $diasAnoAnterior = 0;

        foreach ($periods as $p) {
            $dias = (int) $p->get('diasmarcados');
            if ($p->get('tipoDias') === 'Ano Anterior') {
                $diasAnoAnterior += $dias;
            } else {
                $diasAnoAtual += $dias;
            }
        }

        $diasFeriasAno   = (float) ($ferias->get('diasFeriasAno') ?? 0);
        $diasTransitados = (float) ($ferias->get('diasTransitados') ?? 0);
        $disponiveis     = ($diasFeriasAno + $diasTransitados) - ($diasAnoAtual + $diasAnoAnterior);

        $ferias->set('diasAnoAtualUsados',    $diasAnoAtual);
        $ferias->set('diasTransitadosUsados', $diasAnoAnterior);
        $ferias->set('diasDisponiveis',       $disponiveis);
        $this->entityManager->saveEntity($ferias, ['skipHooks' => true]);
    }
}
