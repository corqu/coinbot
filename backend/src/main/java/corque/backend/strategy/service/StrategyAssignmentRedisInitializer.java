package corque.backend.strategy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StrategyAssignmentRedisInitializer implements ApplicationRunner {

    private final StrategyAssignmentRedisSyncService strategyAssignmentRedisSyncService;

    @Override
    public void run(ApplicationArguments args) {
        strategyAssignmentRedisSyncService.syncAllGroups();
        log.info("Strategy group redis snapshot initialized.");
    }
}

