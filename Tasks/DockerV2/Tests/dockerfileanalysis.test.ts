import * as assert from 'assert'
import { dockerfileAnalysisCore } from '../dockerfileanalysis'

describe('DockerfileAnalysis', () => {
    describe('build arguments parsing', () => {
        it('no build arguments', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '')
            assert.strictEqual(invalidImageRefs.length, 1)
        })

        it('--build-arg=IMAGE=test.azurecr.io/image:v1', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '--build-arg=IMAGE=test.azurecr.io/image:v1')
            assert.strictEqual(invalidImageRefs.length, 0)
        })

        it('--build-arg IMAGE=test.azurecr.io/image:v1', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '--build-arg    IMAGE=test.azurecr.io/image:v1')
            assert.strictEqual(invalidImageRefs.length, 0)
        })

        it('one build argument with other arguments', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '--other-flag -o --build-arg IMAGE=test.azurecr.io/image:v1 --other-flag2')
            assert.strictEqual(invalidImageRefs.length, 0)
        })
    })

    describe('basic FROM', () => {
        it('FROM ubuntu', () => {
            const invalidImageRefs = dockerfileAnalysisCore('FROM ubuntu', '');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM $IMAGE=ubuntu', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '--build-arg IMAGE=ubuntu');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM docker.io/library/hello-world', () => {
            const invalidImageRefs = dockerfileAnalysisCore('FROM docker.io/library/hello-world', '');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM $IMAGE=docker.io/library/hello-world', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '--build-arg IMAGE=docker.io/library/hello-world');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM $IMAGE without set the argument value', () => {
            assert.throws(() => dockerfileAnalysisCore('FROM $IMAGE', ''));
        })

        it('FROM $IMAGE with valid argument value', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG IMAGE\nFROM $IMAGE', '--build-arg IMAGE=test.azurecr.io/image:v1');
            assert.strictEqual(invalidImageRefs.length, 0);
        })
    })

    describe('FROM with placeholder $', () => {
        it('FROM $REGISTRY/ubuntu', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY\nFROM $REGISTRY/ubuntu', '--build-arg REGISTRY=test.azurecr.io');
            assert.strictEqual(invalidImageRefs.length, 0);
        })

        it('FROM $REGISTRY/ubuntu with invalid registry', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY\nFROM $REGISTRY/ubuntu', '--build-arg REGISTRY=test.azurecr2.io');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM $REGISTRY/ubuntu without setting the value', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY\nFROM $REGISTRY/ubuntu', '');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM $REGISTRY/ubuntu with default value', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY=test.azurecr.io\nFROM $REGISTRY/ubuntu', '');
            assert.strictEqual(invalidImageRefs.length, 0);
        })

        it('FROM $REGISTRY/ubuntu with valid default value and override by --build-arg', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY=test.azurecr.io\nFROM $REGISTRY/ubuntu', '--build-arg REGISTRY=test.azurecr2.io');
            assert.strictEqual(invalidImageRefs.length, 1);
        })

        it('FROM $REGISTRY_NAME$REGISTRY_SUFFIX/ubuntu', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY_NAME REGISTRY_SUFFIX\nFROM $REGISTRY_NAME$REGISTRY_SUFFIX/ubuntu', '--build-arg REGISTRY_NAME=test-registry-name --build-arg REGISTRY_SUFFIX=.azurecr.io');
            assert.strictEqual(invalidImageRefs.length, 0);
        })

        it('FROM $REGISTRY/${REPOSITORY}:{TAG}', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY\nARG REPOSITORY\nARG TAG\nFROM $REGISTRY/${REPOSITORY}:${TAG}', '--build-arg REGISTRY=test.azurecr.io --build-arg REPOSITORY=test-repository --build-arg TAG=test-tag');
            assert.strictEqual(invalidImageRefs.length, 0);
        })

        it('FROM $REGISTRY/${REPOSITORY}:{TAG} with invalid registry', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY\nARG REPOSITORY\nARG TAG\nFROM $REGISTRY/${REPOSITORY}:${TAG}', '--build-arg REGISTRY=test.azurecr2.io --build-arg REPOSITORY=test-repository --build-arg TAG=test-tag');
            assert.strictEqual(invalidImageRefs.length, 1);
        })
    })

    describe('ARG with placeholder $', () => {
        it('ARG REGISTRY IMAGE; ARG IMAGE_REF=$REGISTRY/$IMAGE', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY IMAGE\nARG IMAGE_REF=$REGISTRY/$IMAGE\nFROM ${IMAGE_REF}', '--build-arg REGISTRY=test.azurecr.io --build-arg IMAGE=ubuntu');
            assert.strictEqual(invalidImageRefs.length, 0);
        })

        it('ARG REGISTRY IMAGE; ARG IMAGE_REF=$REGISTRY/$IMAGE with invalid registry', () => {
            const invalidImageRefs = dockerfileAnalysisCore('ARG REGISTRY\nARG IMAGE\nARG IMAGE_REF=$REGISTRY/$IMAGE\nFROM ${IMAGE_REF}', '--build-arg REGISTRY=test.azurecr2.io --build-arg IMAGE=ubuntu');
            assert.strictEqual(invalidImageRefs.length, 1);
        })
    })

    describe('multi-stage build', () => {
        it('FROM a.azurecr.io/ubuntu as base', () => {
            const invalidImageRefs = dockerfileAnalysisCore('FROM a.azurecr.io/ubuntu as base\nFROM base', '');
            assert.strictEqual(invalidImageRefs.length, 0);
        })

        it('FROM a.azurecr.io/ubuntu as base; FROM ubuntu', () => {
            const invalidImageRefs = dockerfileAnalysisCore('FROM a.azurecr.io/ubuntu as base\nFROM ubuntu', '');
            assert.strictEqual(invalidImageRefs.length, 1);
        })
    })

    describe('COPY', () => {
        it('COPY --from=ubuntu /file /file', () => {
            const invalidImageRefs = dockerfileAnalysisCore('COPY --from=ubuntu /file /file', '')
            assert.strictEqual(invalidImageRefs.length, 1)
        })

        it('COPY --from=a.azurecr.io/ubuntu /file /file', () => {
            const invalidImageRefs = dockerfileAnalysisCore('COPY --from=a.azurecr.io/ubuntu /file /file', '')
            assert.strictEqual(invalidImageRefs.length, 0)
        })

        it('COPY --from=base /file /file', () => {
            const invalidImageRefs = dockerfileAnalysisCore('FROM a.azurecr.io/ubuntu AS base\nCOPY --from=base /file /file', '')
            assert.strictEqual(invalidImageRefs.length, 0)
        })
    })
})