#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VoiceprintModule, NSObject)

RCT_EXTERN_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(generateEmbedding:(NSString *)base64Pcm
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(compareEmbedding:(NSString *)base64Pcm
                  enrollmentEmbedding:(NSArray<NSNumber *> *)enrollmentEmbedding
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
